import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

/** Railway deployments do not run Drizzle migrations automatically. */
export function ensureExternalApiCacheSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS external_api_cache (
        cacheKey varchar(64) NOT NULL PRIMARY KEY,
        provider varchar(48) NOT NULL,
        payload json NOT NULL,
        freshUntil timestamp NOT NULL,
        staleUntil timestamp NOT NULL,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX external_api_cache_stale_idx (staleUntil)
      )
    `)
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
