import { ENV } from "../_core/env";
import type { PtcgCard, PtcgPrice } from "./pokemontcg";
import { normalizeSearchText, rankSearchResult } from "./searchRelevance";

const BASE_URL = "https://api.tcgpricelookup.com/v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

export type LookupCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string;
  variant?: string;
  image_url?: string;
  imageUrl?: string;
  updated_at?: string;
  updatedAt?: string;
  set?: { slug?: string; name?: string } | string;
  game?: { slug?: string; name?: string } | string;
  prices?: {
    raw?: Record<
      string,
      { tcgplayer?: PtcgPrice; ebay?: Record<string, number | null> }
    >;
    graded?: {
      psa?: Record<
        string,
        { ebay?: Record<string, number | null>; sample_size?: number | null }
      >;
    };
  };
};

type LookupEnvelope = {
  data?: LookupCard[] | LookupCard;
  total?: number;
};

function configured() {
  return Boolean(ENV.tcgPriceLookupApiKey.trim());
}

async function fetchLookup(path: string): Promise<LookupEnvelope | null> {
  if (!configured()) return null;
  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.value as LookupEnvelope;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "X-API-Key": ENV.tcgPriceLookupApiKey },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(
        "[TCG Price Lookup] request rejected",
        response.status,
        path
      );
      return null;
    }
    const value = (await response.json()) as LookupEnvelope;
    cache.set(path, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    console.warn("[TCG Price Lookup] request failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function setInfo(card: LookupCard) {
  if (typeof card.set === "string")
    return {
      id: normalizeSearchText(card.set).replaceAll(" ", "-"),
      name: card.set,
    };
  return {
    id: card.set?.slug ?? "external-catalog",
    name: card.set?.name ?? "External catalog",
  };
}

function rawNearMint(card: LookupCard) {
  const raw = card.prices?.raw ?? {};
  return (
    raw.near_mint?.tcgplayer ??
    raw.nearMint?.tcgplayer ??
    Object.values(raw)[0]?.tcgplayer
  );
}

export function mapLookupCard(card: LookupCard): PtcgCard | null {
  if (!card.id || !card.name) return null;
  const set = setInfo(card);
  const raw = rawNearMint(card);
  const image = card.image_url ?? card.imageUrl ?? "/card-placeholder.svg";
  return {
    id: `tcgpl:${card.id}`,
    name: card.name,
    supertype: "Pokémon",
    number: card.number ?? "—",
    rarity: card.rarity ?? card.variant,
    set: {
      id: set.id,
      name: set.name,
      series:
        typeof card.game === "object"
          ? (card.game.name ?? "Pokémon TCG")
          : (card.game ?? "Pokémon TCG"),
      printedTotal: 0,
      total: 0,
      releaseDate: "",
      updatedAt: card.updated_at ?? card.updatedAt ?? "",
      images: { symbol: "", logo: "" },
    },
    images: { small: image, large: image },
    tcgplayer: raw
      ? {
          url: "",
          updatedAt: card.updated_at ?? card.updatedAt ?? "",
          prices: { normal: raw },
        }
      : undefined,
  };
}

function envelopeCards(envelope: LookupEnvelope | null) {
  if (!envelope?.data) return [];
  return Array.isArray(envelope.data) ? envelope.data : [envelope.data];
}

export async function searchExpandedCatalog(query: string, limit = 24) {
  if (!configured() || !query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    game: "pokemon",
    limit: String(Math.min(limit, 50)),
  });
  const english = envelopeCards(
    await fetchLookup(`/cards/search?${params.toString()}`)
  );
  let rows = english;
  if (
    !rows.length ||
    /\b(japan|japanese|jp|illustrator|promo)\b/i.test(query)
  ) {
    params.set("game", "pokemon-jp");
    const japanese = envelopeCards(
      await fetchLookup(`/cards/search?${params.toString()}`)
    );
    rows = [...english, ...japanese];
  }
  return rows
    .map(card => ({
      card,
      mapped: mapLookupCard(card),
      score: rankSearchResult(query, [
        card.name,
        typeof card.set === "string" ? card.set : card.set?.name,
        card.number,
        card.variant,
      ]),
    }))
    .filter(item => item.mapped)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.mapped!);
}

export async function getExpandedCatalogCard(id: string) {
  if (!configured()) return null;
  const rawId = id.startsWith("tcgpl:") ? id.slice(6) : id;
  const envelope = await fetchLookup(`/cards/${encodeURIComponent(rawId)}`);
  const card = envelopeCards(envelope)[0];
  return card ? mapLookupCard(card) : null;
}

export type PsaComp = {
  grade: number;
  value: number;
  currency: "USD";
  basis: "ebay_7d" | "ebay_30d" | "ebay_latest";
  sourceName: string;
  sourceUrl: string;
  observedAt: string | null;
  sampleSize: number | null;
  note?: string;
};

export function extractPsaComps(card: LookupCard): PsaComp[] {
  const updatedAt = card.updated_at ?? card.updatedAt ?? null;
  return Object.entries(card.prices?.graded?.psa ?? {})
    .map(([gradeText, data]): PsaComp | null => {
      const grade = Number(gradeText);
      const ebay = data?.ebay ?? {};
      const value =
        ebay.avg_7d ??
        ebay.avg7d ??
        ebay.avg_30d ??
        ebay.avg30d ??
        ebay.latest ??
        null;
      if (
        !Number.isFinite(grade) ||
        !Number.isFinite(value) ||
        Number(value) <= 0
      )
        return null;
      const basis =
        ebay.avg_7d != null || ebay.avg7d != null
          ? "ebay_7d"
          : ebay.avg_30d != null || ebay.avg30d != null
            ? "ebay_30d"
            : "ebay_latest";
      return {
        grade,
        value: Number(value),
        currency: "USD",
        basis,
        sourceName: "TCG Price Lookup · eBay sold listings",
        sourceUrl: "https://tcgpricelookup.com/",
        observedAt: updatedAt,
        sampleSize: data.sample_size ?? null,
      };
    })
    .filter((row): row is PsaComp => Boolean(row))
    .sort((a, b) => b.grade - a.grade);
}

export async function getLookupPsaComps(input: {
  externalId?: string;
  name: string;
  setName?: string;
}) {
  if (!configured()) return [];
  let rows: LookupCard[] = [];
  if (input.externalId?.startsWith("tcgpl:")) {
    rows = envelopeCards(
      await fetchLookup(
        `/cards/${encodeURIComponent(input.externalId.slice(6))}`
      )
    );
  } else {
    const query = [input.name, input.setName].filter(Boolean).join(" ");
    const game =
      input.externalId?.startsWith("ja:") || /[^\u0000-\u007f]/.test(input.name)
        ? "pokemon-jp"
        : "pokemon";
    const params = new URLSearchParams({
      q: query,
      game,
      limit: "10",
    });
    rows = envelopeCards(
      await fetchLookup(`/cards/search?${params.toString()}`)
    );
  }
  const best = rows
    .map(card => ({
      card,
      score:
        rankSearchResult(input.name, [card.name]) +
        rankSearchResult(input.setName ?? "", [
          typeof card.set === "string" ? card.set : card.set?.name,
        ]) *
          0.35,
    }))
    .sort((a, b) => b.score - a.score)[0]?.card;
  if (!best) return [];

  return extractPsaComps(best);
}

export function expandedCatalogConfigured() {
  return configured();
}
