/**
 * Minimal Scrydex client for the Pokémon sealed-products catalog.
 *
 * Credentials are read only on the server. Never import this module from the
 * browser bundle or expose the headers through a tRPC response.
 */

const BASE_URL = "https://api.scrydex.com/pokemon/v1";

export interface ScrydexImage {
  type: string;
  small?: string;
  medium?: string;
  large?: string;
}

export interface ScrydexPrice {
  condition?: string;
  is_perfect?: boolean;
  is_signed?: boolean;
  is_error?: boolean;
  type?: string;
  low?: number | null;
  market?: number | null;
  currency?: string;
}

export interface ScrydexVariant {
  name: string;
  images?: ScrydexImage[];
  prices?: ScrydexPrice[];
}

export interface ScrydexExpansion {
  id: string;
  name: string;
  series?: string;
  language?: string;
  language_code?: string;
  release_date?: string;
}

export interface ScrydexSealedProduct {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  images?: ScrydexImage[];
  expansion?: ScrydexExpansion | null;
  language?: string;
  language_code?: string;
  expansion_sort_order?: number;
  variants?: ScrydexVariant[];
}

export interface ScrydexCard {
  id: string;
  name: string;
  number?: string | number;
  rarity?: string | null;
  images?: ScrydexImage[];
  expansion?: ScrydexExpansion | null;
  language?: string;
  language_code?: string;
  variants?: ScrydexVariant[];
}

export interface ScrydexPriceHistoryEntry {
  date: string;
  prices: Array<ScrydexPrice & { variant?: string }>;
}

export interface ScrydexPage<T> {
  status: string;
  data: T[];
  page: number;
  pageSize?: number;
  totalCount?: number;
  page_size?: number;
  total_count?: number;
}

export function scrydexConfigured(): boolean {
  return Boolean(
    process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim()
  );
}

function authHeaders(): Record<string, string> {
  const apiKey = process.env.SCRYDEX_API_KEY?.trim();
  const teamId = process.env.SCRYDEX_TEAM_ID?.trim();
  if (!apiKey || !teamId) {
    throw new Error(
      "Scrydex is not configured (SCRYDEX_API_KEY / SCRYDEX_TEAM_ID)"
    );
  }
  return {
    Accept: "application/json",
    "X-Api-Key": apiKey,
    "X-Team-ID": teamId,
    "User-Agent": "PokeHub/1.0 market-data",
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  // Sealed responses with prices are larger than card lookups. Railway cold
  // starts regularly need more than 20 seconds, so scheduled imports get a
  // realistic timeout without blocking visitor requests.
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body.slice(0, 240).replace(/\s+/g, " ");
      throw new Error(
        `Scrydex API ${response.status}${detail ? `: ${detail}` : ""}`
      );
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSealedProductsPage(
  page = 1,
  pageSize = 50
): Promise<ScrydexPage<ScrydexSealedProduct>> {
  const qs = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(Math.min(100, Math.max(1, pageSize))),
    q: 'language:"English"',
    include: "prices",
    orderBy: "name,-expansion_sort_order",
  });
  return apiFetch<ScrydexPage<ScrydexSealedProduct>>(
    `/sealed?${qs.toString()}`
  );
}

/**
 * Fetch current card metadata and raw prices in as few credits as possible.
 * Scrydex accepts up to 100 cards per page, so the snapshot job batches IDs.
 */
export async function getScrydexCardsByIds(
  cardIds: string[]
): Promise<ScrydexCard[]> {
  const ids = Array.from(
    new Set(
      cardIds.map(id => id.trim()).filter(id => /^[A-Za-z0-9._-]+$/.test(id))
    )
  ).slice(0, 100);
  if (ids.length === 0) return [];
  const qs = new URLSearchParams({
    q: ids.map(id => `id:${id}`).join(" OR "),
    page: "1",
    page_size: "100",
    include: "prices",
  });
  const result = await apiFetch<ScrydexPage<ScrydexCard>>(
    `/cards?${qs.toString()}`
  );
  return Array.isArray(result.data) ? result.data : [];
}

/** Optional Growth-plan history. Callers should gracefully fall back to our snapshots. */
export async function getScrydexCardPriceHistory(
  cardId: string,
  days = 90
): Promise<ScrydexPriceHistoryEntry[]> {
  const qs = new URLSearchParams({
    days: String(Math.min(365, Math.max(1, days))),
    condition: "NM",
    page_size: "100",
  });
  const result = await apiFetch<ScrydexPage<ScrydexPriceHistoryEntry>>(
    `/cards/${encodeURIComponent(cardId)}/price_history?${qs.toString()}`
  );
  return Array.isArray(result.data) ? result.data : [];
}

export function getScrydexCardMarketPrice(card: ScrydexCard): {
  market: number;
  low: number | null;
  variant: string;
  currency: "USD";
} | null {
  const candidates = (card.variants ?? []).flatMap((variant, variantIndex) =>
    (variant.prices ?? [])
      .filter(price => {
        const currency = (price.currency ?? "USD").toUpperCase();
        const condition = (price.condition ?? "NM").toUpperCase();
        const type = (price.type ?? "raw").toLowerCase();
        return currency === "USD" && condition === "NM" && type === "raw";
      })
      .map(price => ({
        variant: variant.name || "market",
        variantIndex,
        market: Number(price.market ?? price.low ?? 0),
        low: price.low == null ? null : Number(price.low),
      }))
      .filter(price => Number.isFinite(price.market) && price.market > 0)
  );
  if (candidates.length === 0) return null;

  const priority = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized === "holofoil" || normalized === "normal") return 0;
    if (normalized.includes("unlimited") && normalized.includes("holo"))
      return 1;
    if (normalized.includes("reverse")) return 3;
    return 2;
  };
  candidates.sort(
    (a, b) =>
      priority(a.variant) - priority(b.variant) ||
      a.variantIndex - b.variantIndex
  );
  const selected = candidates[0];
  return {
    market: selected.market,
    low: selected.low,
    variant: selected.variant,
    currency: "USD",
  };
}

/**
 * Fetch the complete sealed catalog. The safety limit prevents an upstream
 * pagination bug from burning through the account's credit cap.
 */
export async function getAllSealedProducts(maxPages = 20): Promise<{
  products: ScrydexSealedProduct[];
  requests: number;
  totalCount: number;
}> {
  const products: ScrydexSealedProduct[] = [];
  let page = 1;
  let totalCount = 0;

  while (page <= maxPages) {
    const result = await getSealedProductsPage(page, 50);
    totalCount = Number(result.totalCount ?? result.total_count ?? 0);
    products.push(...(Array.isArray(result.data) ? result.data : []));
    if (products.length >= totalCount || result.data.length === 0) break;
    page += 1;
  }

  if (totalCount > products.length && page >= maxPages) {
    throw new Error(
      `Scrydex pagination safety limit reached (${products.length}/${totalCount})`
    );
  }

  return { products, requests: page, totalCount };
}
