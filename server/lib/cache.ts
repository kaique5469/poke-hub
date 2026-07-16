/**
 * Lightweight in-memory cache with TTL support.
 * Used to avoid redundant external API calls across requests.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

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
  const entry = store.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expiresAt > now) return entry.data;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return entry ? entry.data : running;

  const request = fn()
    .then(result => {
      setCache(key, result, ttlMs);
      return result;
    })
    .catch(error => {
      if (entry) return entry.data;
      throw error;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);

  // Expired data is still more useful than a slow or broken page. Refresh it
  // in the background and immediately serve the last verified response.
  if (entry) {
    void request.catch(() => {});
    return entry.data;
  }
  return request;
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
