import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { externalApiCache } from "../drizzle/schema";
import { getDb } from "./db";

export interface ExternalCacheHit<T> {
  data: T;
  isFresh: boolean;
  updatedAt: Date;
}

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Stable, bounded key that never stores a visitor's complete search in MySQL. */
export function externalApiCacheKey(provider: string, requestKey: string) {
  return createHash("sha256")
    .update(`${provider}\0${requestKey}`)
    .digest("hex");
}

export async function readExternalApiCache<T>(
  provider: string,
  requestKey: string,
  now = new Date()
): Promise<ExternalCacheHit<T> | null> {
  const db = await getDb();
  if (!db) return null;
  const cacheKey = externalApiCacheKey(provider, requestKey);
  const [row] = await db
    .select()
    .from(externalApiCache)
    .where(eq(externalApiCache.cacheKey, cacheKey))
    .limit(1);
  if (!row || row.provider !== provider) return null;
  if (row.staleUntil.getTime() <= now.getTime()) {
    void db
      .delete(externalApiCache)
      .where(eq(externalApiCache.cacheKey, cacheKey))
      .catch(() => undefined);
    return null;
  }
  return {
    data: row.payload as T,
    isFresh: row.freshUntil.getTime() > now.getTime(),
    updatedAt: row.updatedAt,
  };
}

export async function writeExternalApiCache<T>(input: {
  provider: string;
  requestKey: string;
  data: T;
  freshForMs: number;
  staleForMs: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  const now = input.now ?? new Date();
  const values = {
    cacheKey: externalApiCacheKey(input.provider, input.requestKey),
    provider: input.provider,
    payload: input.data as object,
    freshUntil: new Date(now.getTime() + input.freshForMs),
    staleUntil: new Date(now.getTime() + input.staleForMs),
    updatedAt: now,
  };
  await db
    .insert(externalApiCache)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });

  if (now.getTime() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
    lastCleanupAt = now.getTime();
    void db
      .delete(externalApiCache)
      .where(lt(externalApiCache.staleUntil, now))
      .catch(error => console.warn("[External cache] Cleanup failed", error));
  }
}
