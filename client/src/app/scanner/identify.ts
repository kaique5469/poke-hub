/**
 * Client for POST /api/scanner/identify. The server returns up to five
 * catalog matches with per-variant prices; the client picks the best one
 * and lets the person correct it in the review sheet.
 */
import type { CardVariant } from "@shared/app";

export type ScanMatch = {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  set: { id: string; name: string; printedTotal: number | null };
  images: { small: string; large: string };
  marketPriceUsd: number | null;
  variantPrices: Record<string, number | null>;
  suggestedVariant: string;
  suggestedPriceUsd: number | null;
  matchScore: number;
};

export type ScanAnalysis = {
  isPokemonCard: boolean;
  name: string | null;
  collectorNumber: string | null;
  setName: string | null;
  languageCode: string | null;
  variant: string | null;
  normalizedVariant: CardVariant;
  graded: boolean;
  gradingCompany: string | null;
  grade: string | null;
  confidence: number;
  notes: string;
};

export type ScanResult = {
  analysis: ScanAnalysis;
  matches: ScanMatch[];
  quota: {
    remaining: number | null;
    dailyLimit: number | null;
    tier: "anonymous" | "free" | "pro";
  };
};

export class ScanError extends Error {
  constructor(
    message: string,
    public code:
      | "rate_limited"
      | "anonymous_limit"
      | "daily_limit"
      | "unidentified"
      | "unavailable"
      | "network",
    public retryAfter?: number
  ) {
    super(message);
  }
}

export async function identifyCard(
  blob: Blob,
  signal?: AbortSignal
): Promise<ScanResult> {
  let response: Response;
  try {
    response = await fetch("/api/scanner/identify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
      signal,
    });
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") throw error;
    throw new ScanError("network", "network");
  }
  const data = (await response.json().catch(() => ({}))) as Partial<ScanResult> & {
    error?: string;
    code?: string;
  };
  if (response.status === 429) {
    const code =
      data.code === "anonymous_limit"
        ? "anonymous_limit"
        : data.code === "daily_limit"
          ? "daily_limit"
          : "rate_limited";
    throw new ScanError(
      data.error ?? "Rate limited",
      code,
      Number(response.headers.get("Retry-After") ?? 60)
    );
  }
  if (response.status === 503) {
    throw new ScanError(data.error ?? "unavailable", "unavailable");
  }
  if (!response.ok || !data.analysis) {
    throw new ScanError(data.error ?? "unidentified", "unidentified");
  }
  return data as ScanResult;
}
