const TOKEN_CORRECTIONS: Record<string, string> = {
  ilustrator: "illustrator",
  ilustrador: "illustrator",
  ilustration: "illustration",
  pikatchu: "pikachu",
  pikaxu: "pikachu",
  charisard: "charizard",
  charizardd: "charizard",
  greninjaa: "greninja",
};

const PHRASE_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bcause\s+rising\b/gi, "chaos rising"],
  [/\bcaos\s+rising\b/gi, "chaos rising"],
  [/\billustrator\s+pikachu\b/gi, "pikachu illustrator"],
  [/\belite\s+trainer\s+box\b/gi, "elite trainer box"],
];

const PRODUCT_ALIASES: Record<string, string> = {
  etb: "elite trainer box",
  bb: "booster box",
  boosterbox: "booster box",
  bundle: "booster bundle",
};

const PRODUCT_TERMS = new Set([
  "elite",
  "trainer",
  "box",
  "etb",
  "booster",
  "bundle",
  "collection",
  "tin",
  "blister",
  "case",
  "display",
  "product",
]);

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function correctSearchText(value: string) {
  let corrected = normalizeSearchText(value);
  for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement);
  }
  corrected = corrected
    .split(" ")
    .flatMap(token =>
      (PRODUCT_ALIASES[token] ?? TOKEN_CORRECTIONS[token] ?? token).split(" ")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return corrected;
}

export function searchCoreTerms(value: string) {
  const corrected = correctSearchText(value);
  const core = corrected
    .split(" ")
    .filter(token => !PRODUCT_TERMS.has(token))
    .join(" ")
    .trim();
  return core || corrected;
}

export function editDistance(leftValue: string, rightValue: string) {
  const left = normalizeSearchText(leftValue);
  const right = normalizeSearchText(rightValue);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  const current = new Array<number>(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

export function searchSimilarity(left: string, right: string) {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.2;
  }
  return Math.max(0, 1 - editDistance(a, b) / Math.max(a.length, b.length));
}

export type SearchableSet = {
  id: string;
  name: string;
  ptcgoCode?: string;
};

export function findBestSetMatch<T extends SearchableSet>(
  query: string,
  sets: T[]
) {
  const core = searchCoreTerms(query);
  const ranked = sets
    .map(set => ({
      set,
      score: Math.max(
        searchSimilarity(core, set.name),
        set.ptcgoCode ? searchSimilarity(core, set.ptcgoCode) : 0,
        searchSimilarity(core, set.id)
      ),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score >= 0.72 ? ranked[0] : null;
}

export function rankSearchResult(
  query: string,
  fields: Array<string | null | undefined>
) {
  const corrected = correctSearchText(query);
  return fields.reduce(
    (best, field) =>
      field ? Math.max(best, searchSimilarity(corrected, field)) : best,
    0
  );
}
