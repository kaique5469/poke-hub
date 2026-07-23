/**
 * Pokémon TCG API client (pokemontcg.io)
 * Handles card and set data with memory + persistent last-known-good caching.
 */

import {
  readExternalApiCache,
  writeExternalApiCache,
} from "../externalApiCacheDb";
import { notifyOwner } from "../_core/notification";

const BASE_URL = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY || "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (API_KEY) headers["X-Api-Key"] = API_KEY;

// Fast process-local cache. The stale limit prevents an old response from
// living forever in a long-running instance.
const cache = new Map<
  string,
  { data: unknown; expires: number; staleExpires: number }
>();

const inflight = new Map<string, Promise<unknown>>();

function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  staleTtlMs = 14 * 24 * 60 * 60 * 1000
): Promise<T> {
  const now = Date.now();
  let hit = cache.get(key);
  if (hit && hit.staleExpires <= now) {
    cache.delete(key);
    hit = undefined;
  }
  if (hit && hit.expires > now) return Promise.resolve(hit.data as T);

  // Deduplicate concurrent identical requests
  const existing = inflight.get(key);
  if (existing) {
    if (hit) return Promise.resolve(hit.data as T); // stale-while-revalidate
    return existing as Promise<T>;
  }

  const p = fn()
    .then(data => {
      cache.set(key, {
        data,
        expires: Date.now() + ttlMs,
        staleExpires: Date.now() + Math.max(ttlMs, staleTtlMs),
      });
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

const STALE_TTL = {
  CARD: 30 * 24 * 60 * 60 * 1000,
  SEARCH: 14 * 24 * 60 * 60 * 1000,
  SETS: 30 * 24 * 60 * 60 * 1000,
};

const PROVIDER = "pokemontcg";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const BREAKER_FAILURE_THRESHOLD = 2;
const BREAKER_COOLDOWN_MS = 45_000;

const breaker = {
  consecutiveFailures: 0,
  openUntil: 0,
  lastAlertAt: 0,
};

let cacheWarningAt = 0;

class PokemonTcgHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`PokémonTCG upstream returned ${status}`);
  }
}

export class CardCatalogUnavailableError extends Error {
  constructor() {
    super("Card catalog is temporarily unavailable. Please try again shortly.");
    this.name = "CardCatalogUnavailableError";
  }
}

export function shouldRetryPokemonStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function pokemonRetryDelayMs(attempt: number, jitter = Math.random()) {
  const base = [350, 1_100][Math.max(0, Math.min(attempt, 1))];
  return Math.round(base + Math.max(0, Math.min(1, jitter)) * 200);
}

function warnCacheFailure(error: unknown) {
  const now = Date.now();
  if (now - cacheWarningAt < 60_000) return;
  cacheWarningAt = now;
  console.warn("[Card catalog] Persistent cache unavailable", error);
}

function recordUpstreamSuccess() {
  breaker.consecutiveFailures = 0;
  breaker.openUntil = 0;
}

function recordUpstreamFailure(error: unknown) {
  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures < BREAKER_FAILURE_THRESHOLD) return;
  const now = Date.now();
  breaker.openUntil = now + BREAKER_COOLDOWN_MS;
  console.error("[Card catalog] Circuit opened after upstream failures", error);
  if (now - breaker.lastAlertAt >= 30 * 60 * 1000) {
    breaker.lastAlertAt = now;
    void notifyOwner({
      title: "RarityGrid: card catalog provider degraded",
      content:
        "The Pokémon TCG catalog provider failed repeatedly. RarityGrid opened its circuit breaker and is serving last-known-good cached data when available.",
    }).catch(alertError =>
      console.error("[Card catalog] Owner alert failed", alertError)
    );
  }
}

async function persistentResponse<T>(input: {
  requestKey: string;
  freshForMs: number;
  staleForMs: number;
  fetchPrimary: () => Promise<T>;
  fetchSecondary?: () => Promise<T | null>;
}): Promise<T> {
  let saved: Awaited<ReturnType<typeof readExternalApiCache<T>>> = null;
  try {
    saved = await readExternalApiCache<T>(PROVIDER, input.requestKey);
    if (saved?.isFresh) return saved.data;
  } catch (error) {
    warnCacheFailure(error);
  }

  try {
    const data = await input.fetchPrimary();
    try {
      await writeExternalApiCache({
        provider: PROVIDER,
        requestKey: input.requestKey,
        data,
        freshForMs: input.freshForMs,
        staleForMs: input.staleForMs,
      });
    } catch (error) {
      warnCacheFailure(error);
    }
    return data;
  } catch (primaryError) {
    if (saved) {
      console.warn(
        `[Card catalog] Serving persistent stale data for ${input.requestKey}`
      );
      return saved.data;
    }
    if (input.fetchSecondary) {
      try {
        const secondary = await input.fetchSecondary();
        if (secondary) {
          console.warn(
            `[Card catalog] Serving secondary provider for ${input.requestKey}`
          );
          try {
            await writeExternalApiCache({
              provider: PROVIDER,
              requestKey: input.requestKey,
              data: secondary,
              freshForMs: input.freshForMs,
              staleForMs: input.staleForMs,
            });
          } catch (error) {
            warnCacheFailure(error);
          }
          return secondary;
        }
      } catch (secondaryError) {
        console.error(
          "[Card catalog] Secondary provider failed",
          secondaryError
        );
      }
    }
    throw primaryError instanceof CardCatalogUnavailableError
      ? primaryError
      : new CardCatalogUnavailableError();
  }
}

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
  if (breaker.openUntil > Date.now()) {
    throw new CardCatalogUnavailableError();
  }
  let lastError: unknown;
  let lastFailureWasRetryable = true;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) throw new PokemonTcgHttpError(res.status, path);
      const data = (await res.json()) as T;
      recordUpstreamSuccess();
      return data;
    } catch (error) {
      lastError = error;
      const retryable =
        !(error instanceof PokemonTcgHttpError) ||
        shouldRetryPokemonStatus(error.status);
      lastFailureWasRetryable = retryable;
      console.warn("[Card catalog] Upstream request failed", {
        attempt: attempt + 1,
        status: error instanceof PokemonTcgHttpError ? error.status : "network",
        path: path.slice(0, 240),
      });
      if (!retryable) break;
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, pokemonRetryDelayMs(attempt))
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastFailureWasRetryable) recordUpstreamFailure(lastError);
  throw new CardCatalogUnavailableError();
}

/** Test isolation for the module-level cache and circuit breaker. */
export function resetPokemonTcgResilienceForTests() {
  cache.clear();
  inflight.clear();
  breaker.consecutiveFailures = 0;
  breaker.openUntil = 0;
  breaker.lastAlertAt = 0;
  cacheWarningAt = 0;
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
  return cached(
    key,
    TTL.SEARCH,
    () =>
      persistentResponse<SearchCardsResult>({
        requestKey: key,
        freshForMs: TTL.SEARCH,
        staleForMs: STALE_TTL.SEARCH,
        fetchPrimary: () =>
          apiFetch<SearchCardsResult>(`/cards?${qs.toString()}`),
        // Blank catalog browsing is the high-traffic failure seen in
        // production. RapidAPI is attempted only with no saved response and
        // after all primary retries, preserving both providers' quotas.
        fetchSecondary:
          !params.q && process.env.RAPIDAPI_KEY?.trim()
            ? async () => {
                const { searchCMCardsGrid } =
                  await import("../cardmarketApi.js");
                const result = await searchCMCardsGrid(
                  "",
                  params.page ?? 1,
                  params.pageSize ?? 24
                );
                return result?.data.length ? result : null;
              }
            : undefined,
      }),
    STALE_TTL.SEARCH
  );
}

export async function getCardById(id: string): Promise<PtcgCard | null> {
  const key = `card:${id}`;
  try {
    return await cached(
      key,
      TTL.CARD,
      () =>
        persistentResponse<PtcgCard>({
          requestKey: key,
          freshForMs: TTL.CARD,
          staleForMs: STALE_TTL.CARD,
          fetchPrimary: async () => {
            const res = await apiFetch<{ data: PtcgCard }>(`/cards/${id}`);
            return res.data;
          },
        }),
      STALE_TTL.CARD
    );
  } catch {
    return null;
  }
}

export async function getCardsByIds(ids: string[]): Promise<PtcgCard[]> {
  const safeIds = Array.from(
    new Set(ids.map(id => id.trim()).filter(id => /^[A-Za-z0-9._-]+$/.test(id)))
  ).slice(0, 250);
  if (!safeIds.length) return [];
  const q = safeIds.map(id => `id:${id}`).join(" OR ");
  const result = await searchCards({ q, pageSize: safeIds.length });
  return result.data;
}

export async function getSets(): Promise<PtcgSet[]> {
  const key = "sets:all";
  return cached(
    key,
    TTL.SETS,
    () =>
      persistentResponse<PtcgSet[]>({
        requestKey: key,
        freshForMs: TTL.SETS,
        staleForMs: STALE_TTL.SETS,
        fetchPrimary: async () => {
          const res = await apiFetch<{ data: PtcgSet[] }>(
            "/sets?orderBy=-releaseDate&pageSize=500"
          );
          return res.data;
        },
      }),
    STALE_TTL.SETS
  );
}

export async function getSetById(id: string): Promise<PtcgSet | null> {
  const key = `set:${id}`;
  try {
    return await cached(
      key,
      TTL.SETS,
      () =>
        persistentResponse<PtcgSet>({
          requestKey: key,
          freshForMs: TTL.SETS,
          staleForMs: STALE_TTL.SETS,
          fetchPrimary: async () => {
            const res = await apiFetch<{ data: PtcgSet }>(`/sets/${id}`);
            return res.data;
          },
        }),
      STALE_TTL.SETS
    );
  } catch {
    return null;
  }
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
