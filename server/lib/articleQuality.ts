const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "for",
  "from",
  "how",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "with",
  "pokemon",
  "tcg",
  "new",
]);

export function articleTitleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 2 && !STOP_WORDS.has(token))
  );
}

export function areArticleTitlesNearDuplicate(a: string, b: string): boolean {
  const left = articleTitleTokens(a);
  const right = articleTitleTokens(b);
  if (!left.size || !right.size) return false;
  const overlap = [...left].filter(token => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return overlap >= 2 && overlap / union >= 0.5;
}

export function dedupeArticlesByTitle<T extends { title: string }>(
  rows: T[]
): T[] {
  const result: T[] = [];
  for (const row of rows) {
    if (
      result.some(existing =>
        areArticleTitlesNearDuplicate(existing.title, row.title)
      )
    )
      continue;
    result.push(row);
  }
  return result;
}
