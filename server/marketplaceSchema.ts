import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

function isDuplicateColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message);
}

function isDuplicateIndex(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
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
      "ALTER TABLE orders ADD COLUMN trackingCarrier varchar(32) NULL"
    );
    await addColumn("ALTER TABLE orders ADD COLUMN shippedAt timestamp NULL");
    await addColumn(
      "ALTER TABLE orders ADD COLUMN disputeReason varchar(64) NULL"
    );
    await addColumn("ALTER TABLE orders ADD COLUMN disputeDetails text NULL");
    await addColumn(
      "ALTER TABLE orders ADD COLUMN disputeOpenedAt timestamp NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN disputeResolution varchar(32) NULL"
    );
    await addColumn(
      "ALTER TABLE orders ADD COLUMN disputeResolvedAt timestamp NULL"
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
    await addIndex(
      "ALTER TABLE orders ADD INDEX orders_fulfillment_queue_idx (status, paymentStatus, createdAt)"
    );

    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS order_events (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        orderId int NOT NULL,
        actorUserId int NULL,
        actorType varchar(32) NOT NULL DEFAULT 'system',
        eventType varchar(64) NOT NULL,
        fromStatus varchar(32) NULL,
        toStatus varchar(32) NULL,
        note text NULL,
        metadata json NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX order_events_order_created_idx (orderId, createdAt),
        INDEX order_events_type_created_idx (eventType, createdAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS marketplace_reports (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        reporterId int NOT NULL,
        sellerId int NULL,
        targetType enum('store','card_listing','product_listing','order') NOT NULL,
        targetId int NOT NULL,
        reason enum('suspected_counterfeit','misleading_listing','prohibited_item','harassment','other') NOT NULL,
        details text NOT NULL,
        status enum('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
        adminNote text NULL,
        resolvedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX marketplace_reports_status_created_idx (status, createdAt),
        INDEX marketplace_reports_seller_created_idx (sellerId, createdAt)
      )
    `)
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
