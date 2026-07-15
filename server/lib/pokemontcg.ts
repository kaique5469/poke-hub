/**
 * Pokémon TCG API client (pokemontcg.io)
 * Handles card and set data with in-memory caching to reduce API calls.
 */

const BASE_URL = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY || "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (API_KEY) headers["X-Api-Key"] = API_KEY;

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expires: number }>();

const inflight = new Map<string, Promise<unknown>>();

function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return Promise.resolve(hit.data as T);

  // Deduplicate concurrent identical requests
  const existing = inflight.get(key);
  if (existing) {
    if (hit) return Promise.resolve(hit.data as T); // stale-while-revalidate
    return existing as Promise<T>;
  }

  const p = fn()
    .then(data => {
      cache.set(key, { data, expires: Date.now() + ttlMs });
      inflight.delete(key);
      return data;
    })
    .catch(err => {
      inflight.delete(key);
      if (hit) return hit.data as T; // serve stale on upstream error
      throw err;
    });
  inflight.set(key, p);

  // Stale hit: refresh in background, return stale immediately
  if (hit) {
    (p as Promise<T>).catch(() => {});
    return Promise.resolve(hit.data as T);
  }
  return p as Promise<T>;
}

const TTL = {
  CARD: 24 * 60 * 60 * 1000, // 24h for individual cards
  SEARCH: 30 * 60 * 1000, // 30min for search results
  SETS: 60 * 60 * 1000, // 1h for sets list
  HIGH_VALUE: 30 * 60 * 1000, // 30min for high-value cards
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PtcgSet {
  id: string;
  name: string;
  series: string;
  ptcgoCode?: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  updatedAt: string;
  images: { symbol: string; logo: string };
}

export interface PtcgCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  abilities?: Array<{ name: string; text: string; type: string }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: PtcgSet;
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities?: { unlimited?: string; standard?: string; expanded?: string };
  images: { small: string; large: string };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      normal?: PtcgPrice;
      holofoil?: PtcgPrice;
      reverseHolofoil?: PtcgPrice;
      "1stEditionHolofoil"?: PtcgPrice;
    };
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      germanProLow?: number;
      suggestedPrice?: number;
      reverseHoloSell?: number;
      reverseHoloLow?: number;
      reverseHoloTrend?: number;
      lowPriceExPlus?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloAvg1?: number;
      reverseHoloAvg7?: number;
      reverseHoloAvg30?: number;
    };
  };
}

export interface PtcgPrice {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
}

export interface SearchCardsParams {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  select?: string;
}

export interface SearchCardsResult {
  data: PtcgCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`PokémonTCG API error ${res.status}: ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Slim field set for card grids — cuts payload ~70% vs full card objects. */
export const GRID_SELECT =
  "id,name,number,rarity,types,supertype,images,set,tcgplayer";

export async function searchCards(
  params: SearchCardsParams
): Promise<SearchCardsResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 24));
  if (params.orderBy) qs.set("orderBy", params.orderBy);
  if (params.select) qs.set("select", params.select);

  const key = `search:${qs.toString()}`;
  return cached(key, TTL.SEARCH, () =>
    apiFetch<SearchCardsResult>(`/cards?${qs.toString()}`)
  );
}

export async function getCardById(id: string): Promise<PtcgCard | null> {
  return cached(`card:${id}`, TTL.CARD, async () => {
    try {
      const res = await apiFetch<{ data: PtcgCard }>(`/cards/${id}`);
      return res.data;
    } catch {
      return null;
    }
  });
}

export async function getCardsByIds(ids: string[]): Promise<PtcgCard[]> {
  if (!ids.length) return [];
  const q = ids.map(id => `id:${id}`).join(" OR ");
  const result = await searchCards({ q, pageSize: ids.length });
  return result.data;
}

export async function getSets(): Promise<PtcgSet[]> {
  return cached("sets:all", TTL.SETS, async () => {
    const res = await apiFetch<{ data: PtcgSet[] }>(
      "/sets?orderBy=-releaseDate&pageSize=500"
    );
    return res.data;
  });
}

export async function getSetById(id: string): Promise<PtcgSet | null> {
  return cached(`set:${id}`, TTL.SETS, async () => {
    try {
      const res = await apiFetch<{ data: PtcgSet }>(`/sets/${id}`);
      return res.data;
    } catch {
      return null;
    }
  });
}

export async function getHighValueCards(page = 1): Promise<SearchCardsResult> {
  const rarities = [
    "Special Illustration Rare",
    "Hyper Rare",
    "Secret Rare",
    "Rainbow Rare",
  ];
  const q = rarities.map(r => `rarity:"${r}"`).join(" OR ");
  return cached(`high-value:${page}`, TTL.HIGH_VALUE, () =>
    searchCards({
      q,
      page,
      pageSize: 20,
      orderBy: "-set.releaseDate",
      select: GRID_SELECT,
    })
  );
}

export function getTcgPlayerUrl(cardName: string, setName?: string): string {
  const q = setName ? `${cardName} ${setName}` : cardName;
  return `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(q)}&view=grid`;
}

export function getEbayUrl(cardName: string, setName?: string): string {
  const q = setName
    ? `Pokemon ${cardName} ${setName}`
    : `Pokemon ${cardName} card`;
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=183454`;
}

export function getCardMarketUrl(cardName: string): string {
  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}`;
}

export function getPriceFromCard(card: PtcgCard): PtcgPrice | null {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;
  return (
    prices.holofoil ??
    prices["1stEditionHolofoil"] ??
    prices.normal ??
    prices.reverseHolofoil ??
    null
  );
}

export function isSpecialRare(rarity?: string): boolean {
  if (!rarity) return false;
  const special = [
    "Special Illustration Rare",
    "Hyper Rare",
    "Mega Hyper Rare",
    "Secret Rare",
    "Rainbow Rare",
    "Gold Rare",
    "Shiny Rare",
    "Shiny Ultra Rare",
    "Double Rare",
    "Ultra Rare",
    "Illustration Rare",
  ];
  return special.some(r => rarity.toLowerCase().includes(r.toLowerCase()));
}
