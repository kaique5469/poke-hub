import { z } from "zod";
import { ENV } from "./_core/env";
import {
  getPriceFromCard,
  searchCards,
  GRID_SELECT,
  type PtcgCard,
} from "./lib/pokemontcg";

export const scannerAnalysisSchema = z.object({
  isPokemonCard: z.boolean(),
  name: z.string().nullable(),
  collectorNumber: z.string().nullable(),
  printedTotal: z.number().int().nullable(),
  setName: z.string().nullable(),
  setCode: z.string().nullable(),
  languageCode: z.string().nullable(),
  variant: z.string().nullable(),
  graded: z.boolean(),
  gradingCompany: z.string().nullable(),
  grade: z.string().nullable(),
  certificationNumber: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});

export type ScannerAnalysis = z.infer<typeof scannerAnalysisSchema>;

const SCANNER_SCHEMA = {
  type: "object",
  properties: {
    isPokemonCard: { type: "boolean" },
    name: { type: ["string", "null"] },
    collectorNumber: { type: ["string", "null"] },
    printedTotal: { type: ["integer", "null"] },
    setName: { type: ["string", "null"] },
    setCode: { type: ["string", "null"] },
    languageCode: { type: ["string", "null"] },
    variant: { type: ["string", "null"] },
    graded: { type: "boolean" },
    gradingCompany: { type: ["string", "null"] },
    grade: { type: ["string", "null"] },
    certificationNumber: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" },
  },
  required: [
    "isPokemonCard",
    "name",
    "collectorNumber",
    "printedTotal",
    "setName",
    "setCode",
    "languageCode",
    "variant",
    "graded",
    "gradingCompany",
    "grade",
    "certificationNumber",
    "confidence",
    "notes",
  ],
  additionalProperties: false,
} as const;

const PROMPT = `Identify the single trading card that occupies most of this image.
This RarityGrid scanner supports Pokémon TCG cards only.

Read printed evidence carefully, especially the card name, collector number, printed set total, set code, language, and visible variant. If the card is slabbed, also read the grading label. Do not infer physical condition, authenticity, or monetary value. Do not invent missing text. If this is not a Pokémon card, set isPokemonCard=false and use null for unknown identity fields. If glare, blur, cropping, or multiple cards make the result uncertain, lower confidence and explain that briefly in notes. Use the two-letter language code when possible.`;

type OpenAIResponse = {
  status?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  error?: { message?: string };
};

function responseText(data: OpenAIResponse) {
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw new Error("The image could not be analyzed safely.");
      }
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("The scanner returned no readable result.");
}

export async function analyzeCardImage(
  image: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  fetchImpl: typeof fetch = fetch
): Promise<ScannerAnalysis> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ENV.openaiScannerModel,
        store: false,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${image.toString("base64")}`,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pokemon_card_scan",
            strict: true,
            schema: SCANNER_SCHEMA,
          },
        },
        max_output_tokens: 500,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as OpenAIResponse;
    if (!response.ok) {
      throw new Error(
        data.error?.message ||
          `OpenAI scanner request failed (${response.status}).`
      );
    }
    return scannerAnalysisSchema.parse(JSON.parse(responseText(data)));
  } finally {
    clearTimeout(timeout);
  }
}

const normalize = (value?: string | null) =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const safePhrase = (value?: string | null) =>
  (value ?? "")
    .replace(/[\\"]/g, " ")
    .replace(/[^\p{L}\p{N} .:'’+\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const cleanCollectorNumber = (value?: string | null) => {
  const match = (value ?? "").match(/[A-Za-z]*\d+[A-Za-z]*/);
  return match?.[0]?.replace(/^0+(?=\d)/, "") ?? "";
};

export function scoreCanonicalCard(card: PtcgCard, analysis: ScannerAnalysis) {
  let score = 0;
  const detectedName = normalize(analysis.name);
  const cardName = normalize(card.name);
  if (detectedName && cardName === detectedName) score += 52;
  else if (
    detectedName &&
    (cardName.includes(detectedName) || detectedName.includes(cardName))
  )
    score += 32;

  const number = cleanCollectorNumber(analysis.collectorNumber);
  if (number && normalize(card.number) === normalize(number)) score += 26;
  if (analysis.printedTotal && card.set.printedTotal === analysis.printedTotal)
    score += 10;

  const setName = normalize(analysis.setName);
  if (setName && normalize(card.set.name) === setName) score += 10;
  else if (setName && normalize(card.set.name).includes(setName)) score += 6;

  const setCode = normalize(analysis.setCode);
  if (setCode && normalize(card.set.ptcgoCode) === setCode) score += 8;
  return Math.min(score, 100);
}

async function catalogSearch(analysis: ScannerAnalysis) {
  const number = cleanCollectorNumber(analysis.collectorNumber);
  const name = safePhrase(analysis.name);
  const setName = safePhrase(analysis.setName);
  const queries: string[] = [];

  if (number && analysis.printedTotal) {
    queries.push(`number:${number} set.printedTotal:${analysis.printedTotal}`);
  }
  if (number && name) queries.push(`number:${number} name:"${name}*"`);
  if (name && setName) queries.push(`name:"${name}*" set.name:"${setName}"`);
  if (name) queries.push(`name:"${name}*"`);

  const found = new Map<string, PtcgCard>();
  for (const q of queries) {
    try {
      const result = await searchCards({
        q,
        page: 1,
        pageSize: 20,
        orderBy: "-set.releaseDate",
        select: GRID_SELECT,
      });
      for (const card of result.data) found.set(card.id, card);
      if (found.size >= 12) break;
    } catch {
      // Try the next, broader canonical query.
    }
  }
  return [...found.values()];
}

export async function confirmScannerMatches(analysis: ScannerAnalysis) {
  if (!analysis.isPokemonCard || !analysis.name) return [];
  const cards = await catalogSearch(analysis);
  return cards
    .map(card => {
      const market = getPriceFromCard(card);
      return {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity ?? null,
        set: {
          id: card.set.id,
          name: card.set.name,
          printedTotal: card.set.printedTotal,
        },
        images: card.images,
        marketPriceUsd: market?.market ?? null,
        matchScore: scoreCanonicalCard(card, analysis),
      };
    })
    .filter(card => card.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}
