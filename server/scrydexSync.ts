import type { InsertProduct } from "../drizzle/schema";
import {
  deactivateLegacyCatalogProducts,
  upsertProductBySlug,
} from "./marketplaceDb";
import {
  getAllSealedProducts,
  scrydexConfigured,
  type ScrydexPrice,
  type ScrydexSealedProduct,
} from "./lib/scrydex";

const SYNC_INTERVAL_MS = 23 * 60 * 60 * 1000;

type ProductCategory = InsertProduct["category"];

export interface ScrydexSyncResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  fetched: number;
  upserted: number;
  deactivated: number;
  requests: number;
  totalCount: number;
}

function categoryFromType(type: string, name: string): ProductCategory {
  const value = `${type} ${name}`.toLowerCase();
  if (value.includes("elite trainer box")) return "etb";
  if (value.includes("booster box")) return "booster_box";
  if (value.includes("booster pack") || value.includes("sleeved booster")) return "booster_pack";
  if (value.includes("blister")) return "blister";
  if (value.includes("tin")) return "tin";
  if (value.includes("build & battle") || value.includes("build and battle") || value.includes("prerelease")) return "pre_release";
  if (value.includes("world championship")) return "world_championship";
  if (value.includes("battle deck")) return "battle_deck";
  if (value.includes("theme deck") || value.includes("starter deck")) return "theme_deck";
  if (value.includes("trainer kit")) return "trainer_kit";
  if (value.includes("sleeve")) return "sleeves";
  if (value.includes("playmat")) return "playmat";
  if (value.includes("binder") || value.includes("portfolio")) return "binder_portfolio";
  if (value.includes("deck box")) return "deck_box";
  if (value.includes("pin")) return "pin";
  if (value.includes("coin")) return "coin";
  return "collector_box";
}

function chooseImage(product: ScrydexSealedProduct): string | null {
  const images = [
    ...(product.images ?? []),
    ...(product.variants ?? []).flatMap((variant) => variant.images ?? []),
  ];
  const front = images.find((image) => image.type?.toLowerCase() === "front") ?? images[0];
  return front?.large ?? front?.medium ?? front?.small ?? null;
}

function usablePrices(product: ScrydexSealedProduct): ScrydexPrice[] {
  return (product.variants ?? [])
    .flatMap((variant) => variant.prices ?? [])
    .filter((price) => {
      const currencyOk = !price.currency || price.currency.toUpperCase() === "USD";
      const raw = !price.type || price.type.toLowerCase() === "raw";
      return currencyOk && raw && !price.is_error && !price.is_signed;
    });
}

function pricesFor(product: ScrydexSealedProduct): Pick<InsertProduct, "minPriceUsd" | "avgPriceUsd" | "maxPriceUsd"> {
  const prices = usablePrices(product);
  const lows = prices.map((price) => price.low).filter((price): price is number => typeof price === "number" && price >= 0);
  const markets = prices.map((price) => price.market).filter((price): price is number => typeof price === "number" && price >= 0);
  const reference = markets.length > 0 ? markets : lows;
  const min = lows.length > 0 ? Math.min(...lows) : reference.length > 0 ? Math.min(...reference) : null;
  const average = reference.length > 0 ? reference.reduce((sum, price) => sum + price, 0) / reference.length : null;
  const max = reference.length > 0 ? Math.max(...reference) : null;
  const money = (value: number | null) => value === null ? null : value.toFixed(2);
  return { minPriceUsd: money(min), avgPriceUsd: money(average), maxPriceUsd: money(max) };
}

export function mapScrydexProduct(product: ScrydexSealedProduct): InsertProduct {
  return {
    name: product.name.trim(),
    slug: `scrydex-${product.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    description: product.description?.trim() || null,
    imageUrl: chooseImage(product),
    category: categoryFromType(product.type, product.name),
    language: product.language ?? product.expansion?.language ?? "English",
    setId: product.expansion?.id ?? null,
    setName: product.expansion?.name ?? null,
    ...pricesFor(product),
    isActive: true,
  };
}

let syncPromise: Promise<ScrydexSyncResult> | null = null;
let lastSuccessfulSyncAt = 0;

export async function syncScrydexSealedProducts(force = false): Promise<ScrydexSyncResult> {
  if (!scrydexConfigured()) {
    return { ok: false, skipped: true, reason: "not_configured", fetched: 0, upserted: 0, deactivated: 0, requests: 0, totalCount: 0 };
  }

  if (!force && lastSuccessfulSyncAt && Date.now() - lastSuccessfulSyncAt < SYNC_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: "fresh", fetched: 0, upserted: 0, deactivated: 0, requests: 0, totalCount: 0 };
  }

  const result = await getAllSealedProducts();
  let upserted = 0;
  for (const product of result.products) {
    if (!product.id || !product.name || !product.type) continue;
    await upsertProductBySlug(mapScrydexProduct(product));
    upserted += 1;
  }

  // Only hide synthetic/legacy rows after a successful, non-empty real sync.
  const deactivated = upserted > 0 ? await deactivateLegacyCatalogProducts() : 0;
  lastSuccessfulSyncAt = Date.now();
  return {
    ok: true,
    skipped: false,
    fetched: result.products.length,
    upserted,
    deactivated,
    requests: result.requests,
    totalCount: result.totalCount,
  };
}

/** Deduplicates concurrent first-page requests while the initial import runs. */
export function ensureProductsSynced(): Promise<ScrydexSyncResult> {
  if (!syncPromise) {
    syncPromise = syncScrydexSealedProducts(false)
      .catch((error) => {
        console.error("[scrydex] sealed catalog sync failed:", error);
        return { ok: false, skipped: false, reason: "error", fetched: 0, upserted: 0, deactivated: 0, requests: 0, totalCount: 0 };
      })
      .finally(() => { syncPromise = null; });
  }
  return syncPromise;
}
