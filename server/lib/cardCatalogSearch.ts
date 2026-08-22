import { searchCMCardsGrid } from "../cardmarketApi";
import {
  GRID_SELECT,
  getSets,
  searchCards,
  type PtcgCard,
  type SearchCardsResult,
} from "./pokemontcg";
import { searchHistoricCards } from "./historicCards";
import {
  searchExpandedCatalog,
  expandedCatalogConfigured,
} from "./tcgPriceLookup";
import {
  correctSearchText,
  findBestSetMatch,
  normalizeSearchText,
  rankSearchResult,
  searchCoreTerms,
} from "./searchRelevance";

export type CatalogSearchInput = {
  q?: string;
  page: number;
  pageSize: number;
  set?: string;
  type?: string;
  rarity?: string;
  supertype?: string;
};

export type CatalogSearchMeta = {
  originalQuery: string;
  correctedQuery: string | null;
  searchedAs: string;
  matchedSet: { id: string; name: string } | null;
  matchMode: "browse" | "code" | "exact" | "corrected" | "set" | "related";
  expandedCatalog: boolean;
};

export type CatalogSearchResult = SearchCardsResult & {
  searchMeta: CatalogSearchMeta;
};

function escapeCatalogTerm(value: string) {
  return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function mergeCards(primary: PtcgCard[], additions: PtcgCard[], query: string) {
  const seen = new Set<string>();
  return [...additions, ...primary]
    .filter(card => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    })
    .sort((left, right) => {
      const historicLeft = left.id.startsWith("historic:") ? 1 : 0;
      const historicRight = right.id.startsWith("historic:") ? 1 : 0;
      if (historicLeft !== historicRight) return historicRight - historicLeft;
      return (
        rankSearchResult(query, [right.name, right.set?.name, right.number]) -
        rankSearchResult(query, [left.name, left.set?.name, left.number])
      );
    });
}

export async function searchCardCatalog(
  input: CatalogSearchInput
): Promise<CatalogSearchResult> {
  const original = (input.q ?? "").trim();
  const corrected = correctSearchText(original);
  const normalizedOriginal = normalizeSearchText(original);
  const searchedAs = escapeCatalogTerm(corrected || original);
  const correctedQuery =
    original && corrected !== normalizedOriginal ? corrected : null;

  const buildFilters = () => {
    const parts: string[] = [];
    if (input.set) parts.push(`set.id:${escapeCatalogTerm(input.set)}`);
    if (input.type) parts.push(`types:${escapeCatalogTerm(input.type)}`);
    if (input.rarity) parts.push(`rarity:"${escapeCatalogTerm(input.rarity)}"`);
    if (input.supertype)
      parts.push(`supertype:${escapeCatalogTerm(input.supertype)}`);
    return parts;
  };
  const run = (extra: string[]) => {
    const q = [...extra, ...buildFilters()].join(" ");
    return searchCards({
      q: q || undefined,
      page: input.page,
      pageSize: input.pageSize,
      orderBy: "-set.releaseDate",
      select: GRID_SELECT,
    });
  };
  let baseError: unknown;
  const safeRun = async (extra: string[]) => {
    try {
      return await run(extra);
    } catch (error) {
      baseError = error;
      return null;
    }
  };

  const cleanNum = (value: string) => value.replace(/^0+(?=\d)/, "");
  const idMatch = original.match(/^([a-z0-9.]+)-(\d+[a-zA-Z]*|[A-Z]+\d+)$/i);
  const numMatch = original.match(/^(\d{1,3}[a-zA-Z]?)\s*\/\s*(\d{1,3})$/);
  const setCodeMatch = original.match(
    /^([a-zA-Z]{2,6})[\s-]+(\d{1,3}[a-zA-Z]?)$/
  );
  let codeQuery: string[] | null = null;
  if (idMatch) codeQuery = [`id:${original.toLowerCase()}`];
  else if (numMatch) {
    codeQuery = [
      `number:${cleanNum(numMatch[1])}`,
      `set.printedTotal:${Number.parseInt(numMatch[2], 10)}`,
    ];
  } else if (setCodeMatch) {
    codeQuery = [
      `set.ptcgoCode:${setCodeMatch[1].toUpperCase()}`,
      `number:${cleanNum(setCodeMatch[2])}`,
    ];
  }

  const hasFilters = Boolean(
    input.set || input.type || input.rarity || input.supertype
  );
  let matchedSet: Awaited<ReturnType<typeof getSets>>[number] | null = null;
  if (original && !codeQuery && !input.set) {
    try {
      const sets = await getSets();
      matchedSet =
        findBestSetMatch(searchCoreTerms(original), sets)?.set ?? null;
    } catch {
      matchedSet = null;
    }
  }

  let base: SearchCardsResult | null = null;
  const rapidQuery = numMatch
    ? null
    : setCodeMatch
      ? `${setCodeMatch[1].toUpperCase()} ${cleanNum(setCodeMatch[2])}`
      : idMatch
        ? null
        : searchedAs;

  if (rapidQuery && !hasFilters && !matchedSet) {
    try {
      const rapid = await searchCMCardsGrid(
        rapidQuery,
        input.page,
        input.pageSize
      );
      if (rapid?.count) base = rapid;
    } catch {
      base = null;
    }
  }

  if (!base) {
    if (codeQuery) {
      const [byCode, byName] = await Promise.allSettled([
        run(codeQuery),
        run([`name:"${escapeCatalogTerm(original)}*"`]),
      ]);
      if (byCode.status === "fulfilled" && byCode.value.totalCount > 0)
        base = byCode.value;
      else if (byName.status === "fulfilled") base = byName.value;
      else if (byCode.status === "fulfilled") base = byCode.value;
      else baseError = byName.reason ?? byCode.reason;
    } else if (matchedSet) {
      base = await safeRun([`set.id:${matchedSet.id}`]);
    } else {
      base = await safeRun(searchedAs ? [`name:"${searchedAs}*"`] : []);
      if (base && !base.totalCount && searchedAs.includes(" ")) {
        const firstUsefulToken = searchedAs
          .split(" ")
          .find(token => token.length >= 3 && token !== "pokemon");
        if (firstUsefulToken) {
          const related = await safeRun([`name:"${firstUsefulToken}*"`]);
          if (related) {
            base = {
              ...related,
              data: related.data
                .sort(
                  (a, b) =>
                    rankSearchResult(searchedAs, [b.name, b.set?.name]) -
                    rankSearchResult(searchedAs, [a.name, a.set?.name])
                )
                .slice(0, input.pageSize),
            };
          }
        }
      }
    }
  }

  const additions: PtcgCard[] = [];
  if (original && input.page === 1 && !hasFilters && !codeQuery) {
    additions.push(...searchHistoricCards(searchedAs, input.pageSize));
    if (expandedCatalogConfigured()) {
      additions.push(
        ...(await searchExpandedCatalog(searchedAs, input.pageSize))
      );
    }
  }
  if (!base) {
    if (!additions.length && baseError) throw baseError;
    base = {
      data: [],
      page: input.page,
      pageSize: input.pageSize,
      count: 0,
      totalCount: 0,
    };
  }
  const merged = mergeCards(base.data, additions, searchedAs);
  const extraCount = merged.filter(
    card => !base.data.some(item => item.id === card.id)
  ).length;
  const matchMode: CatalogSearchMeta["matchMode"] = !original
    ? "browse"
    : codeQuery
      ? "code"
      : matchedSet
        ? "set"
        : correctedQuery
          ? "corrected"
          : base.totalCount
            ? "exact"
            : "related";

  return {
    ...base,
    data: merged.slice(0, input.pageSize + extraCount),
    count: merged.length,
    totalCount: base.totalCount + extraCount,
    searchMeta: {
      originalQuery: original,
      correctedQuery,
      searchedAs,
      matchedSet: matchedSet
        ? { id: matchedSet.id, name: matchedSet.name }
        : null,
      matchMode,
      expandedCatalog: expandedCatalogConfigured(),
    },
  };
}
