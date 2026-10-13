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

/**
 * Columns the mobile app shell (`/app`) depends on. Self-bootstraps at boot
 * because Railway does not run Drizzle migrations (see growthSchema.ts).
 * Mirrored in drizzle/schema.ts.
 */
export function ensureAppSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    // User preferences: UI language and display currency.
    await addColumn(
      "ALTER TABLE users ADD COLUMN locale varchar(8) NULL"
    );
    await addColumn(
      "ALTER TABLE users ADD COLUMN currency varchar(3) NULL"
    );
    // Pro subscription (Stripe).
    await addColumn(
      "ALTER TABLE users ADD COLUMN plan varchar(16) NOT NULL DEFAULT 'free'"
    );
    await addColumn("ALTER TABLE users ADD COLUMN proUntil timestamp NULL");
    await addColumn(
      "ALTER TABLE users ADD COLUMN stripeCustomerId varchar(64) NULL"
    );
    await addColumn(
      "ALTER TABLE users ADD COLUMN stripeSubscriptionId varchar(64) NULL"
    );
    // Printed variant per collection row (holo vs reverse can differ 10×).
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN variant varchar(24) NOT NULL DEFAULT 'normal'"
    );
    // Local id of the item when it was scanned before sign-in; lets the
    // client merge its offline queue idempotently.
    await addColumn(
      "ALTER TABLE binder_cards ADD COLUMN clientId varchar(40) NULL"
    );
    await db
      .execute(
        sql.raw(
          "CREATE INDEX binder_cards_user_client_idx ON binder_cards (userId, clientId)"
        )
      )
      .catch(() => undefined);
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
