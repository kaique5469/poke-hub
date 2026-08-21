import {
  dropRetailerCurrency,
  isDropRetailer,
  isDropStockState,
  normalizeProductUrl,
  type DropProviderPayload,
  type DropProviderProduct,
  type DropRetailer,
} from "../shared/drops";
import { ENV } from "./_core/env";

type ProviderProductInput = {
  retailer?: unknown;
  retailerProductId?: unknown;
  title?: unknown;
  productUrl?: unknown;
  imageUrl?: unknown;
  stockState?: unknown;
  priceCents?: unknown;
  currency?: unknown;
  observedAt?: unknown;
  source?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > maxLength) return null;
  return clean;
}

function optionalHttpsUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseDropProviderProduct(
  input: ProviderProductInput
): DropProviderProduct | null {
  if (typeof input.retailer !== "string" || !isDropRetailer(input.retailer)) {
    return null;
  }
  if (
    typeof input.stockState !== "string" ||
    !isDropStockState(input.stockState)
  ) {
    return null;
  }
  const retailer = input.retailer;
  const title = cleanText(input.title, 512);
  const retailerProductId = cleanText(input.retailerProductId, 192);
  const rawProductUrl = cleanText(input.productUrl, 2_048);
  const productUrl = rawProductUrl
    ? normalizeProductUrl(retailer, rawProductUrl)
    : null;
  if (!title || !retailerProductId || !productUrl) return null;

  const observedAt = new Date(
    typeof input.observedAt === "string" ||
      typeof input.observedAt === "number"
      ? input.observedAt
      : Date.now()
  );
  if (!Number.isFinite(observedAt.getTime())) return null;
  const futureSkew = observedAt.getTime() - Date.now();
  if (futureSkew > 5 * 60_000) return null;

  const priceCents =
    typeof input.priceCents === "number" &&
    Number.isInteger(input.priceCents) &&
    input.priceCents >= 0 &&
    input.priceCents <= 100_000_000
      ? input.priceCents
      : null;
  const currency =
    input.currency === "BRL" || input.currency === "USD"
      ? input.currency
      : dropRetailerCurrency(retailer);

  return {
    retailer,
    retailerProductId,
    title,
    productUrl,
    imageUrl: optionalHttpsUrl(input.imageUrl),
    stockState: input.stockState,
    priceCents,
    currency,
    observedAt,
    source: cleanText(input.source, 64) ?? "inventory_provider",
  };
}

export function parseDropProviderPayload(input: unknown): DropProviderPayload {
  const body = input as { products?: unknown; requestId?: unknown };
  if (!body || !Array.isArray(body.products)) {
    throw new Error("Provider response must contain a products array");
  }
  if (body.products.length > 100) {
    throw new Error("Provider response exceeded 100 products");
  }
  const products = body.products
    .map(row => parseDropProviderProduct(row as ProviderProductInput))
    .filter((row): row is DropProviderProduct => row !== null);
  return {
    products,
    requestId: cleanText(body.requestId, 128) ?? undefined,
  };
}

function providerEndpoint() {
  if (!ENV.dropProviderUrl) return null;
  const url = new URL(ENV.dropProviderUrl);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error("DROP_PROVIDER_URL must use HTTPS");
  }
  return url;
}

export function dropProviderConfigured() {
  try {
    return (
      providerEndpoint() !== null &&
      Boolean(ENV.dropProviderApiKey) &&
      ENV.dropProviderRetailers.length > 0
    );
  } catch {
    return false;
  }
}

export function dropProviderCoverage() {
  return [...ENV.dropProviderRetailers];
}

export function dropProviderCovers(retailer: DropRetailer) {
  return ENV.dropProviderRetailers.includes(retailer);
}

export async function fetchDropProviderProducts(input: {
  retailer: DropRetailer;
  query: string;
  productUrl?: string | null;
}): Promise<DropProviderPayload> {
  const endpoint = providerEndpoint();
  if (!endpoint || !ENV.dropProviderApiKey) {
    throw new Error("Authorized inventory provider is not configured");
  }
  if (!dropProviderCovers(input.retailer)) {
    throw new Error("Inventory provider does not cover this retailer");
  }
  endpoint.searchParams.set("retailer", input.retailer);
  endpoint.searchParams.set("q", input.query);
  if (input.productUrl) endpoint.searchParams.set("url", input.productUrl);

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${ENV.dropProviderApiKey}`,
      Accept: "application/json",
      "User-Agent": "RarityGrid-DropMonitor/1.0",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Inventory provider returned HTTP ${response.status}`);
  }
  return parseDropProviderPayload(await response.json());
}
