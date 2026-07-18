import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

function duplicateColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message);
}

async function addColumn(statement: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql.raw(statement));
  } catch (error) {
    if (!duplicateColumn(error)) throw error;
  }
}

/** Self-bootstraps growth columns because Railway does not run migrations. */
export function ensureGrowthSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN purchasePriceUsd decimal(10,2) NULL"
    );
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN acquiredAt timestamp NULL"
    );
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN acquisitionSource varchar(32) NULL"
    );
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN gradingCompany varchar(16) NULL"
    );
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN grade decimal(3,1) NULL"
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        totalValueUsd decimal(14,2) NOT NULL,
        totalCostUsd decimal(14,2) NOT NULL,
        cardCount int NOT NULL,
        pricedCards int NOT NULL,
        recordedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX portfolio_snapshots_user_recorded_idx (userId, recordedAt)
      )
    `)
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
