import { cached, TTL } from "./cache";
import {
  readExternalApiCache,
  writeExternalApiCache,
} from "../externalApiCacheDb";
import type { AppCurrency } from "@shared/app";

/**
 * USD → BRL reference rate for displaying card prices in two currencies.
 *
 * Source: Frankfurter (European Central Bank reference rates, no API key).
 * The rate is a display aid, not a trading quote — the app labels converted
 * prices as "estimated by exchange rate" until real BRL market data exists.
 *
 * Caching: 12 h in memory, last-known-good in `external_api_cache` for 14 d,
 * and a hard-coded floor so the app never shows R$ 0,00 if everything fails.
 */

export type FxRates = {
  base: "USD";
  rates: Record<AppCurrency, number>;
  asOf: string; // YYYY-MM-DD from the provider
  fetchedAt: string; // ISO timestamp
  source: "frankfurter" | "cache" | "fallback";
};

const PROVIDER = "frankfurter";
const REQUEST_KEY = "latest:USD:BRL";
const FALLBACK_USD_BRL = 5.5;

async function fetchFrankfurter(fetchImpl: typeof fetch): Promise<FxRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(
      "https://api.frankfurter.app/latest?from=USD&to=BRL",
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`frankfurter ${response.status}`);
    const data = (await response.json()) as {
      date?: string;
      rates?: { BRL?: number };
    };
    const brl = Number(data.rates?.BRL);
    if (!Number.isFinite(brl) || brl <= 0) {
      throw new Error("frankfurter returned no BRL rate");
    }
    return {
      base: "USD",
      rates: { USD: 1, BRL: Number(brl.toFixed(4)) },
      asOf: data.date ?? new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
      source: "frankfurter",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function fallbackFxRates(): FxRates {
  return {
    base: "USD",
    rates: { USD: 1, BRL: FALLBACK_USD_BRL },
    asOf: "fallback",
    fetchedAt: new Date().toISOString(),
    source: "fallback",
  };
}

export async function getFxRates(
  fetchImpl: typeof fetch = fetch
): Promise<FxRates> {
  return cached("fx:usd-brl", TTL.ONE_HOUR * 12, async () => {
    try {
      const live = await fetchFrankfurter(fetchImpl);
      await writeExternalApiCache({
        provider: PROVIDER,
        requestKey: REQUEST_KEY,
        data: live,
        freshForMs: TTL.ONE_HOUR * 12,
        staleForMs: TTL.ONE_DAY * 14,
      }).catch(() => undefined);
      return live;
    } catch (error) {
      console.warn("[fx] live rate unavailable, using cache", error);
      const hit = await readExternalApiCache<FxRates>(
        PROVIDER,
        REQUEST_KEY
      ).catch(() => null);
      if (hit) return { ...hit.data, source: "cache" as const };
      return fallbackFxRates();
    }
  });
}

/** Converts a USD amount to the target currency using the given rates. */
export function convertFromUsd(
  amountUsd: number | null | undefined,
  currency: AppCurrency,
  rates: FxRates
): number | null {
  if (amountUsd == null || !Number.isFinite(amountUsd)) return null;
  const rate = rates.rates[currency] ?? 1;
  return Math.round(amountUsd * rate * 100) / 100;
}
