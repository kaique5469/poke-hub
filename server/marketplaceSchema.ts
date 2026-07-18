import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

function isDuplicateColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message);
}

function isDuplicateIndex(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "ER_DUP_KEYNAME" || /duplicate key name/i.test(message);
}

async function addColumn(statement: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql.raw(statement));
  } catch (error) {
    if (!isDuplicateColumn(error)) throw error;
  }
}

async function addIndex(statement: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql.raw(statement));
  } catch (error) {
    if (!isDuplicateIndex(error)) throw error;
  }
}

/**
 * Railway deployments don't run Drizzle migrations automatically. Keep the
 * marketplace safety columns self-bootstrapping before HTTP traffic starts.
 */
export function ensureMarketplaceSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;

    await addColumn(
      "ALTER TABLE orders ADD COLUMN stripeSessionExpiresAt timestamp NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN shippingName varchar(160) NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN shippingPhone varchar(40) NULL"
    );
    await addColumn("ALTER TABLE orders ADD COLUMN shippingAddress json NULL");
    await addColumn(
      "ALTER TABLE orders ADD COLUMN buyerTermsVersion varchar(32) NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN buyerTermsAcceptedAt timestamp NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN cancellationReason varchar(255) NULL"
    );
    await addColumn(
      "ALTER TABLE seller_stores ADD COLUMN sellerTermsVersion varchar(32) NULL"
    );
    await addColumn(
      "ALTER TABLE seller_stores ADD COLUMN sellerTermsAcceptedAt timestamp NULL"
    );
    await addIndex(
      "ALTER TABLE orders ADD INDEX orders_stripe_session_idx (stripeSessionId)"
    );
    await addIndex(
      "ALTER TABLE orders ADD INDEX orders_reservation_expiry_idx (status, paymentStatus, stripeSessionExpiresAt)"
    );

    // Existing sellers explicitly accept the current version in their
    // dashboard before their inventory becomes public again.
    await db.execute(
      sql.raw("UPDATE seller_stores SET paymentMethods = JSON_ARRAY('card')")
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
