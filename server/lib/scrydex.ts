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
  return Boolean(process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim());
}

function authHeaders(): Record<string, string> {
  const apiKey = process.env.SCRYDEX_API_KEY?.trim();
  const teamId = process.env.SCRYDEX_TEAM_ID?.trim();
  if (!apiKey || !teamId) {
    throw new Error("Scrydex is not configured (SCRYDEX_API_KEY / SCRYDEX_TEAM_ID)");
  }
  return {
    Accept: "application/json",
    "X-Api-Key": apiKey,
    "X-Team-ID": teamId,
    "User-Agent": "PokeHub/1.0 sealed-catalog-sync",
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body.slice(0, 240).replace(/\s+/g, " ");
      throw new Error(`Scrydex API ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSealedProductsPage(page = 1, pageSize = 100): Promise<ScrydexPage<ScrydexSealedProduct>> {
  const qs = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(Math.min(100, Math.max(1, pageSize))),
    include: "prices",
    orderBy: "name,-expansion_sort_order",
  });
  return apiFetch<ScrydexPage<ScrydexSealedProduct>>(`/sealed?${qs.toString()}`);
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
    const result = await getSealedProductsPage(page, 100);
    totalCount = Number(result.totalCount ?? result.total_count ?? 0);
    products.push(...(Array.isArray(result.data) ? result.data : []));
    if (products.length >= totalCount || result.data.length === 0) break;
    page += 1;
  }

  if (totalCount > products.length && page >= maxPages) {
    throw new Error(`Scrydex pagination safety limit reached (${products.length}/${totalCount})`);
  }

  return { products, requests: page, totalCount };
}
