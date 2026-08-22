import type { PtcgCard, PtcgSet, SearchCardsResult } from "./pokemontcg";

const PHYSICAL_ONLY = (image?: string) => !!image && !image.includes("/tcgp/");
type TcgDexLocale = "pt-br" | "ja";

interface TcgDexCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface TcgDexCard extends TcgDexCardSummary {
  category?: string;
  illustrator?: string;
  rarity?: string;
  hp?: number;
  types?: string[];
  description?: string;
  dexId?: number[];
  set?: {
    id: string;
    name: string;
    cardCount?: { official?: number; total?: number };
    logo?: string;
    symbol?: string;
  };
}

async function tcgdexFetch<T>(locale: TcgDexLocale, path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://api.tcgdex.net/v2/${locale}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TCGdex error ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function imageUrl(base: string | undefined, quality: "low" | "high") {
  return base ? `${base}/${quality}.webp` : "";
}

function localeMeta(locale: TcgDexLocale) {
  return locale === "ja"
    ? { prefix: "ja", label: "Japanese", series: "Japanese cards" }
    : {
        prefix: "ptbr",
        label: "Pokémon TCG em português",
        series: "Português (Brasil)",
      };
}

function adaptSet(set: TcgDexCard["set"], locale: TcgDexLocale): PtcgSet {
  const meta = localeMeta(locale);
  return {
    id: `${meta.prefix}:${set?.id ?? "unknown"}`,
    name: set?.name ?? meta.label,
    series: meta.series,
    printedTotal: set?.cardCount?.official ?? 0,
    total: set?.cardCount?.total ?? set?.cardCount?.official ?? 0,
    releaseDate: "",
    updatedAt: "",
    images: {
      symbol: imageUrl(set?.symbol, "low"),
      logo: imageUrl(set?.logo, "high"),
    },
  };
}

function adaptSummary(card: TcgDexCardSummary, locale: TcgDexLocale): PtcgCard {
  const meta = localeMeta(locale);
  return {
    id: `${meta.prefix}:${card.id}`,
    name: card.name,
    supertype: "Pokémon TCG",
    set: adaptSet(undefined, locale),
    number: card.localId,
    images: {
      small: imageUrl(card.image, "low"),
      large: imageUrl(card.image, "high"),
    },
  };
}

function adaptCard(card: TcgDexCard, locale: TcgDexLocale): PtcgCard {
  return {
    ...adaptSummary(card, locale),
    supertype: card.category ?? "Pokémon TCG",
    hp: card.hp ? String(card.hp) : undefined,
    types: card.types,
    artist: card.illustrator,
    rarity: card.rarity,
    flavorText: card.description,
    nationalPokedexNumbers: card.dexId,
    set: adaptSet(card.set, locale),
  };
}

export async function searchLocalizedCards(input: {
  q?: string;
  page: number;
  pageSize: number;
  locale: TcgDexLocale;
}): Promise<SearchCardsResult> {
  const qs = new URLSearchParams({
    "pagination:page": String(input.page),
    "pagination:itemsPerPage": String(Math.min(input.pageSize * 2, 100)),
  });
  if (input.q?.trim()) qs.set("name", `like:${input.q.trim()}`);
  const rows = await tcgdexFetch<TcgDexCardSummary[]>(
    input.locale,
    `/cards?${qs}`
  );
  const physical = rows.filter(card => PHYSICAL_ONLY(card.image));
  const data = physical
    .slice(0, input.pageSize)
    .map(card => adaptSummary(card, input.locale));
  return {
    data,
    page: input.page,
    pageSize: input.pageSize,
    count: data.length,
    // TCGdex does not expose a stable total for filtered multilingual lists.
    totalCount:
      data.length < input.pageSize
        ? (input.page - 1) * input.pageSize + data.length
        : input.page * input.pageSize + 1,
  };
}

export async function getLocalizedCard(
  id: string,
  locale: TcgDexLocale
): Promise<PtcgCard | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  try {
    const card = await tcgdexFetch<TcgDexCard>(locale, `/cards/${id}`);
    return PHYSICAL_ONLY(card.image) ? adaptCard(card, locale) : null;
  } catch {
    return null;
  }
}

export async function searchPortugueseCards(input: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  return searchLocalizedCards({ ...input, locale: "pt-br" });
}

export async function searchJapaneseCards(input: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  return searchLocalizedCards({ ...input, locale: "ja" });
}

export function getPortugueseCard(id: string) {
  return getLocalizedCard(id, "pt-br");
}

export function getJapaneseCard(id: string) {
  return getLocalizedCard(id, "ja");
}
