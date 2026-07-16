import type { InsertProduct } from "../drizzle/schema";
import {
  deactivateLegacyCatalogProducts,
  upsertProductBySlug,
} from "./marketplaceDb";
import {
  forEachEnglishSealedProductPage,
  scrydexConfigured,
  type ScrydexPrice,
  type ScrydexSealedProduct,
} from "./lib/scrydex";

const SYNC_INTERVAL_MS = 23 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 15 * 60 * 1000;

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
  if (value.includes("booster pack") || value.includes("sleeved booster"))
    return "booster_pack";
  if (value.includes("blister")) return "blister";
  if (value.includes("tin")) return "tin";
  if (
    value.includes("build & battle") ||
    value.includes("build and battle") ||
    value.includes("prerelease")
  )
    return "pre_release";
  if (value.includes("world championship")) return "world_championship";
  if (value.includes("battle deck")) return "battle_deck";
  if (value.includes("theme deck") || value.includes("starter deck"))
    return "theme_deck";
  if (value.includes("trainer kit")) return "trainer_kit";
  if (value.includes("sleeve")) return "sleeves";
  if (value.includes("playmat")) return "playmat";
  if (value.includes("binder") || value.includes("portfolio"))
    return "binder_portfolio";
  if (value.includes("deck box")) return "deck_box";
  if (value.includes("pin")) return "pin";
  if (value.includes("coin")) return "coin";
  return "collector_box";
}

function chooseImage(product: ScrydexSealedProduct): string | null {
  const images = [
    ...(product.images ?? []),
    ...(product.variants ?? []).flatMap(variant => variant.images ?? []),
  ];
  const front =
    images.find(image => image.type?.toLowerCase() === "front") ?? images[0];
  // Medium is sharp enough for the catalog and substantially lighter than
  // multi-megabyte source artwork. Detail pages can still scale it cleanly.
  return front?.medium ?? front?.large ?? front?.small ?? null;
}

function usablePrices(product: ScrydexSealedProduct): ScrydexPrice[] {
  return (product.variants ?? [])
    .flatMap(variant => variant.prices ?? [])
    .filter(price => {
      const currencyOk =
        !price.currency || price.currency.toUpperCase() === "USD";
      const raw = !price.type || price.type.toLowerCase() === "raw";
      return currencyOk && raw && !price.is_error && !price.is_signed;
    });
}

function pricesFor(
  product: ScrydexSealedProduct
): Pick<InsertProduct, "minPriceUsd" | "avgPriceUsd" | "maxPriceUsd"> {
  const prices = usablePrices(product);
  const lows = prices
    .map(price => price.low)
    .filter(
      (price): price is number => typeof price === "number" && price >= 0
    );
  const markets = prices
    .map(price => price.market)
    .filter(
      (price): price is number => typeof price === "number" && price >= 0
    );
  const reference = markets.length > 0 ? markets : lows;
  const min =
    lows.length > 0
      ? Math.min(...lows)
      : reference.length > 0
        ? Math.min(...reference)
        : null;
  const average =
    reference.length > 0
      ? reference.reduce((sum, price) => sum + price, 0) / reference.length
      : null;
  const max = reference.length > 0 ? Math.max(...reference) : null;
  const money = (value: number | null) =>
    value === null ? null : value.toFixed(2);
  return {
    minPriceUsd: money(min),
    avgPriceUsd: money(average),
    maxPriceUsd: money(max),
  };
}

export function mapScrydexProduct(
  product: ScrydexSealedProduct
): InsertProduct {
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
let lastAttemptAt = 0;
let lastError: string | null = null;
let progress = {
  stage: "idle" as
    "idle" | "preparing" | "fetching" | "saving" | "ready" | "error",
  page: 0,
  fetched: 0,
  upserted: 0,
  totalCount: 0,
};

export async function syncScrydexSealedProducts(
  force = false
): Promise<ScrydexSyncResult> {
  // Never expose generated seed rows as a real catalog. Rows attached to an
  // actual seller listing are deliberately preserved by the DB helper.
  const hiddenLegacy = await deactivateLegacyCatalogProducts();

  if (!scrydexConfigured()) {
    lastAttemptAt = Date.now();
    lastError = "not_configured";
    return {
      ok: false,
      skipped: true,
      reason: "not_configured",
      fetched: 0,
      upserted: 0,
      deactivated: hiddenLegacy,
      requests: 0,
      totalCount: 0,
    };
  }

  if (
    !force &&
    lastSuccessfulSyncAt &&
    Date.now() - lastSuccessfulSyncAt < SYNC_INTERVAL_MS
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "fresh",
      fetched: 0,
      upserted: 0,
      deactivated: 0,
      requests: 0,
      totalCount: 0,
    };
  }

  if (!force && lastError && Date.now() - lastAttemptAt < FAILURE_BACKOFF_MS) {
    return {
      ok: false,
      skipped: true,
      reason: "backoff",
      fetched: 0,
      upserted: 0,
      deactivated: hiddenLegacy,
      requests: 0,
      totalCount: 0,
    };
  }

  lastAttemptAt = Date.now();
  progress = {
    stage: "fetching",
    page: 0,
    fetched: 0,
    upserted: 0,
    totalCount: 0,
  };
  let fetched = 0;
  let upserted = 0;
  const result = await forEachEnglishSealedProductPage(async batch => {
    fetched += batch.products.length;
    progress = {
      stage: "saving",
      page: batch.page,
      fetched,
      upserted,
      totalCount: batch.totalCount,
    };

    // Keep below the default MySQL pool size while avoiding one network round
    // trip at a time for hundreds of catalog rows.
    for (let index = 0; index < batch.products.length; index += 8) {
      const chunk = batch.products.slice(index, index + 8);
      await Promise.all(
        chunk.map(product => {
          if (!product.id || !product.name || !product.type) return undefined;
          return upsertProductBySlug(mapScrydexProduct(product)).then(() => {
            upserted += 1;
            progress = { ...progress, upserted };
          });
        })
      );
    }

    progress = { ...progress, stage: "fetching" };
  });
  if (upserted === 0) {
    lastError = "empty_catalog";
    progress = { ...progress, stage: "error" };
    throw new Error("Scrydex returned no English sealed products");
  }

  // Only hide synthetic/legacy rows after a successful, non-empty real sync.
  const deactivated =
    hiddenLegacy + (upserted > 0 ? await deactivateLegacyCatalogProducts() : 0);
  lastSuccessfulSyncAt = Date.now();
  lastError = null;
  progress = { ...progress, stage: "ready" };
  return {
    ok: true,
    skipped: false,
    fetched,
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
      .catch(error => {
        console.error("[scrydex] sealed catalog sync failed:", error);
        lastAttemptAt = Date.now();
        lastError = error instanceof Error ? error.message : "error";
        progress = { ...progress, stage: "error" };
        return {
          ok: false,
          skipped: false,
          reason: "error",
          fetched: 0,
          upserted: 0,
          deactivated: 0,
          requests: 0,
          totalCount: 0,
        };
      })
      .finally(() => {
        syncPromise = null;
      });
  }
  return syncPromise;
}

export function getCatalogSyncStatus() {
  return {
    configured: scrydexConfigured(),
    syncing: Boolean(syncPromise),
    lastAttemptAt: lastAttemptAt ? new Date(lastAttemptAt).toISOString() : null,
    lastSuccessfulSyncAt: lastSuccessfulSyncAt
      ? new Date(lastSuccessfulSyncAt).toISOString()
      : null,
    healthy: Boolean(lastSuccessfulSyncAt && !lastError),
    progress,
    state: !scrydexConfigured()
      ? "not_configured"
      : syncPromise
        ? "syncing"
        : lastError
          ? "degraded"
          : lastSuccessfulSyncAt
            ? "ready"
            : "pending",
  } as const;
}
