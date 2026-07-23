import type { PtcgCard, PtcgSet, SearchCardsResult } from "./pokemontcg";

const BASE_URL = "https://api.tcgdex.net/v2/pt-br";
const PHYSICAL_ONLY = (image?: string) => !!image && !image.includes("/tcgp/");

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

async function tcgdexFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
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

function adaptSet(set: TcgDexCard["set"]): PtcgSet {
  return {
    id: `ptbr:${set?.id ?? "unknown"}`,
    name: set?.name ?? "Pokémon TCG em português",
    series: "Português (Brasil)",
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

function adaptSummary(card: TcgDexCardSummary): PtcgCard {
  return {
    id: `ptbr:${card.id}`,
    name: card.name,
    supertype: "Pokémon TCG",
    set: adaptSet(undefined),
    number: card.localId,
    images: {
      small: imageUrl(card.image, "low"),
      large: imageUrl(card.image, "high"),
    },
  };
}

function adaptCard(card: TcgDexCard): PtcgCard {
  return {
    ...adaptSummary(card),
    supertype: card.category ?? "Pokémon TCG",
    hp: card.hp ? String(card.hp) : undefined,
    types: card.types,
    artist: card.illustrator,
    rarity: card.rarity,
    flavorText: card.description,
    nationalPokedexNumbers: card.dexId,
    set: adaptSet(card.set),
  };
}

export async function searchPortugueseCards(input: {
  q?: string;
  page: number;
  pageSize: number;
}): Promise<SearchCardsResult> {
  const qs = new URLSearchParams({
    "pagination:page": String(input.page),
    "pagination:itemsPerPage": String(Math.min(input.pageSize * 2, 100)),
  });
  if (input.q?.trim()) qs.set("name", `like:${input.q.trim()}`);
  const rows = await tcgdexFetch<TcgDexCardSummary[]>(`/cards?${qs}`);
  const physical = rows.filter(card => PHYSICAL_ONLY(card.image));
  const data = physical.slice(0, input.pageSize).map(adaptSummary);
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

export async function getPortugueseCard(id: string): Promise<PtcgCard | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  try {
    const card = await tcgdexFetch<TcgDexCard>(`/cards/${id}`);
    return PHYSICAL_ONLY(card.image) ? adaptCard(card) : null;
  } catch {
    return null;
  }
}
