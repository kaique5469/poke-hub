/**
 * Lightweight in-memory cache with TTL support.
 * Used to avoid redundant external API calls across requests.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Convenience wrapper: get from cache or compute and store */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = getCache<T>(key);
  if (hit !== null) return hit;
  const result = await fn();
  setCache(key, result, ttlMs);
  return result;
}

// TTL constants
export const TTL = {
  ONE_MIN: 60_000,
  FIVE_MIN: 5 * 60_000,
  FIFTEEN_MIN: 15 * 60_000,
  ONE_HOUR: 60 * 60_000,
  SIX_HOURS: 6 * 60 * 60_000,
  ONE_DAY: 24 * 60 * 60_000,
};
