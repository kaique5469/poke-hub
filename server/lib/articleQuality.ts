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

export type EditorialSource = { title: string; url: string };

const PRIMARY_SOURCE_HOSTS = new Set([
  "pokemon.com",
  "www.pokemon.com",
  "support.pokemon.com",
  "press.pokemon.com",
  "rk9.gg",
  "www.rk9.gg",
  "limitlesstcg.com",
  "www.limitlesstcg.com",
]);

const BLOCKED_SOURCE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "tiktok.com",
  "www.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "x.com",
  "twitter.com",
]);

export function validateEditorialSources(sources: EditorialSource[]) {
  const normalized = sources
    .map(source => {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:" || BLOCKED_SOURCE_HOSTS.has(url.hostname))
          return null;
        return {
          title: source.title.trim(),
          url: url.toString(),
          host: url.hostname.toLowerCase(),
        };
      } catch {
        return null;
      }
    })
    .filter((source): source is EditorialSource & { host: string } =>
      Boolean(source?.title && source.title.length >= 3)
    );
  const unique = normalized.filter(
    (source, index) =>
      normalized.findIndex(item => item.url === source.url) === index
  );
  const uniqueHosts = new Set(unique.map(source => source.host));
  const hasPrimarySource = unique.some(source =>
    PRIMARY_SOURCE_HOSTS.has(source.host)
  );
  return {
    valid: unique.length >= 2 && uniqueHosts.size >= 2 && hasPrimarySource,
    sources: unique.slice(0, 5).map(({ title, url }) => ({ title, url })),
    hasPrimarySource,
    reason:
      unique.length < 2 || uniqueHosts.size < 2
        ? "at least two independent HTTPS sources on different domains are required"
        : !hasPrimarySource
          ? "an official Pokémon or primary tournament source is required"
          : null,
  };
}

export function stripGeneratedSourceSection(content: string) {
  return content.replace(/\n+##\s+Sources\s*\n[\s\S]*$/i, "").trim();
}

const QUARANTINED_TITLE_PATTERNS = [
  /\bbattle styles 2\.0\b/i,
  /\belements unleashed\b/i,
  /\beclipse of legends\b/i,
  /\beternal legends\b/i,
  /\brotation 2026 officially announced\b/i,
];

export function isPublicEditorialArticle(article: {
  title: string;
  tags?: unknown;
}) {
  if (QUARANTINED_TITLE_PATTERNS.some(pattern => pattern.test(article.title)))
    return false;
  return true;
}

export function isSourceVerifiedArticle(article: { tags?: unknown }) {
  return (
    Array.isArray(article.tags) && article.tags.includes("source-verified")
  );
}
