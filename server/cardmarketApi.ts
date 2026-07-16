/**
 * CardMarket API helper (via RapidAPI — cardmarket-api-tcg.p.rapidapi.com)
 * Provides real TCGPlayer (USD) + CardMarket (EUR) prices for Pokémon TCG cards.
 *
 * Rate limits: 100 req/day (free), 3000/day (Pro $9.90/mo)
 * We cache results in-memory for 1 hour to stay within limits.
 */

import { ENV } from "./_core/env.js";

const RAPIDAPI_HOST = "cardmarket-api-tcg.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// ─── In-memory cache ─────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CMCardPrices {
  cardmarket: {
    currency: string;
    lowest_near_mint: number | null;
    lowest_near_mint_DE: number | null;
    lowest_near_mint_FR: number | null;
    lowest_near_mint_ES: number | null;
    lowest_near_mint_IT: number | null;
    avg_30d: number | null;
    avg_7d: number | null;
    available_items: number | null;
    graded_psa10: number | null;
    graded_psa9: number | null;
    graded_cgc10: number | null;
  };
  tcgplayer: {
    currency: string;
    market_price: number | null;
    mid_price: number | null;
  };
  cardId: number | null;
  cardName: string;
  setName: string;
  tcgId: string | null;
}

export interface CMPriceHistoryEntry {
  date: string;
  cm_low: number | null;
  tcg_market: number | null;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function cmFetch<T>(path: string): Promise<T | null> {
  if (!ENV.rapidApiKey) {
    console.warn("[CardMarket API] RAPIDAPI_KEY not set");
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "x-rapidapi-key": ENV.rapidApiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`[CardMarket API] ${res.status} ${res.statusText} — ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[CardMarket API] fetch error:", err);
    return null;
  }
}

// ─── Search for a card by pokemontcg.io ID (tcgid) ───────────────────────────
export async function getCMCardByTcgId(tcgId: string): Promise<CMCardPrices | null> {
  const cacheKey = `cm:card:${tcgId}`;
  const cached = getCache<CMCardPrices>(cacheKey);
  if (cached) return cached;

  // Search by tcgid field
  const result = await cmFetch<{ data: any[] }>(`/pokemon/cards?search=${encodeURIComponent(tcgId)}&per_page=5`);
  if (!result?.data?.length) return null;

  // Find the exact match by tcgid
  const card = result.data.find((c: any) => c.tcgid === tcgId) ?? result.data[0];
  const prices = buildPrices(card);
  setCache(cacheKey, prices);
  return prices;
}

// ─── Search for a card by name + set name ────────────────────────────────────
export async function getCMCardByNameAndSet(name: string, setName: string): Promise<CMCardPrices | null> {
  const cacheKey = `cm:search:${name}:${setName}`;
  const cached = getCache<CMCardPrices>(cacheKey);
  if (cached) return cached;

  const query = `${name} ${setName}`.trim();
  const result = await cmFetch<{ data: any[] }>(`/pokemon/cards?search=${encodeURIComponent(query)}&per_page=5`);
  if (!result?.data?.length) return null;

  // Prefer exact name match
  const card =
    result.data.find((c: any) => c.name?.toLowerCase() === name.toLowerCase()) ?? result.data[0];
  const prices = buildPrices(card);
  setCache(cacheKey, prices);
  return prices;
}

// ─── Get price history for a CM card ID ──────────────────────────────────────
export async function getCMPriceHistory(cmCardId: number, days = 90): Promise<CMPriceHistoryEntry[]> {
  const cacheKey = `cm:history:${cmCardId}:${days}`;
  const cached = getCache<CMPriceHistoryEntry[]>(cacheKey);
  if (cached) return cached;

  const result = await cmFetch<{ data: Record<string, any> }>(
    `/pokemon/cards/${cmCardId}/history-prices?days=${days}`
  );
  if (!result?.data) return [];

  const entries: CMPriceHistoryEntry[] = Object.entries(result.data)
    .map(([date, v]: [string, any]) => ({
      date,
      cm_low: v.cm_low ?? null,
      tcg_market: v.tcg_player_market ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  setCache(cacheKey, entries);
  return entries;
}

// ─── Internal: build CMCardPrices from raw API response ──────────────────────
function buildPrices(card: any): CMCardPrices {
  const cm = card.prices?.cardmarket ?? {};
  const tcg = card.prices?.tcg_player ?? {};
  return {
    cardId: card.id ?? null,
    cardName: card.name ?? "",
    setName: card.episode?.name ?? "",
    tcgId: card.tcgid ?? null,
    cardmarket: {
      currency: cm.currency ?? "EUR",
      lowest_near_mint: cm.lowest_near_mint ?? null,
      lowest_near_mint_DE: cm.lowest_near_mint_DE ?? null,
      lowest_near_mint_FR: cm.lowest_near_mint_FR ?? null,
      lowest_near_mint_ES: cm.lowest_near_mint_ES ?? null,
      lowest_near_mint_IT: cm.lowest_near_mint_IT ?? null,
      avg_30d: cm["30d_average"] ?? null,
      avg_7d: cm["7d_average"] ?? null,
      available_items: cm.available_items ?? null,
      graded_psa10: cm.graded?.psa?.psa10 ?? null,
      graded_psa9: cm.graded?.psa?.psa9 ?? null,
      graded_cgc10: cm.graded?.cgc?.cgc10 ?? null,
    },
    tcgplayer: {
      currency: tcg.currency ?? "USD",
      market_price: tcg.market_price ?? null,
      mid_price: tcg.mid_price ?? null,
    },
  };
}

// ─── Card search (grid) via RapidAPI ─────────────────────────────────────────
// Maps CardMarket API TCG results to the pokemontcg.io card shape the client
// grid expects. Free plan = 100 req/day, so results are cached for 24h.
import type { SearchCardsResult, PtcgCard } from "./lib/pokemontcg.js";

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

function mapCMCardToPtcg(c: any): PtcgCard | null {
  const tcgid: string | null = c.tcgid ?? null;
  if (!tcgid || !c.image) return null; // need pokemontcg id for detail page links
  const setId = tcgid.slice(0, tcgid.lastIndexOf("-"));
  const marketUsd =
    c.prices?.tcg_player?.market_price ??
    c.prices?.cardmarket?.["30d_average"] ??
    c.prices?.cardmarket?.lowest_near_mint ??
    null;
  return {
    id: tcgid,
    name: c.name ?? "",
    supertype: c.supertype ?? "Pokémon",
    number: String(c.card_number ?? ""),
    rarity: c.rarity ?? undefined,
    hp: c.hp != null ? String(c.hp) : undefined,
    set: {
      id: setId,
      name: c.episode?.name ?? "",
      series: c.series?.name ?? "",
      printedTotal: c.episode?.cards_printed_total ?? 0,
      total: c.episode?.cards_total ?? 0,
      releaseDate: c.episode?.released_at ?? "",
      updatedAt: "",
      images: { symbol: c.episode?.logo ?? "", logo: c.episode?.logo ?? "" },
    },
    images: { small: c.image, large: c.image },
    tcgplayer: marketUsd != null
      ? { url: "", updatedAt: "", prices: { normal: { market: marketUsd } } }
      : undefined,
  } as PtcgCard;
}

export async function searchCMCardsGrid(
  query: string,
  page = 1,
  pageSize = 24,
): Promise<SearchCardsResult | null> {
  const cacheKey = `cm:grid:${query.toLowerCase()}:${page}:${pageSize}`;
  const hit = cache.get(cacheKey) as CacheEntry<SearchCardsResult> | undefined;
  if (hit && Date.now() < hit.expiresAt) return hit.data;

  const result = await cmFetch<{ data: any[]; meta?: { total?: number; last_page?: number } }>(
    `/pokemon/cards?search=${encodeURIComponent(query)}&per_page=${pageSize}&page=${page}`
  );
  if (!result?.data) return null; // quota/error → caller falls back

  const cards = result.data.map(mapCMCardToPtcg).filter((c): c is PtcgCard => c !== null);
  const totalCount =
    result.meta?.total ??
    (result.data.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + result.data.length);

  const mapped: SearchCardsResult = {
    data: cards,
    page,
    pageSize,
    count: cards.length,
    totalCount,
  };
  cache.set(cacheKey, { data: mapped, expiresAt: Date.now() + SEARCH_TTL_MS });
  return mapped;
}
