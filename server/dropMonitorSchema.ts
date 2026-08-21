import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

/** Railway does not run Drizzle migrations during a normal deploy. */
export function ensureDropMonitorSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;

    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_monitors (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        legacyAlertId int NULL,
        userId int NOT NULL,
        retailer varchar(32) NOT NULL,
        productName varchar(512) NOT NULL,
        productUrl text NULL,
        searchQuery varchar(512) NOT NULL,
        maxPriceCents int NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        desiredQuantity int NOT NULL DEFAULT 1,
        monitorMode varchar(24) NOT NULL DEFAULT 'always',
        handoffMode varchar(24) NOT NULL DEFAULT 'open_product',
        isActive boolean NOT NULL DEFAULT true,
        lastStockState varchar(24) NOT NULL DEFAULT 'unknown',
        lastPriceCents int NULL,
        lastCheckedAt timestamp NULL,
        lastTriggeredAt timestamp NULL,
        lastError varchar(512) NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY drop_monitors_legacy_alert_unique (legacyAlertId),
        INDEX drop_monitors_user_active_idx (userId, isActive),
        INDEX drop_monitors_due_idx (isActive, lastCheckedAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_release_windows (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        retailer varchar(32) NOT NULL,
        label varchar(160) NOT NULL,
        timezone varchar(64) NOT NULL DEFAULT 'America/New_York',
        weekday int NOT NULL,
        startMinute int NOT NULL,
        endMinute int NOT NULL,
        burstIntervalSeconds int NOT NULL DEFAULT 5,
        isActive boolean NOT NULL DEFAULT true,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX drop_release_windows_user_retailer_idx (userId, retailer, isActive)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_product_states (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        monitorId int NOT NULL,
        retailerProductId varchar(192) NOT NULL,
        title varchar(512) NOT NULL,
        productUrl text NOT NULL,
        stockState varchar(24) NOT NULL DEFAULT 'unknown',
        priceCents int NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        firstSeenAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        lastSeenAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        lastTriggeredAt timestamp NULL,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY drop_product_states_monitor_product_unique (monitorId, retailerProductId),
        INDEX drop_product_states_monitor_seen_idx (monitorId, lastSeenAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_events (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        monitorId int NOT NULL,
        userId int NOT NULL,
        fingerprint varchar(64) NOT NULL,
        eventType varchar(24) NOT NULL,
        retailer varchar(32) NOT NULL,
        retailerProductId varchar(192) NOT NULL,
        title varchar(512) NOT NULL,
        productUrl text NOT NULL,
        imageUrl text NULL,
        priceCents int NULL,
        currency varchar(3) NOT NULL DEFAULT 'USD',
        source varchar(64) NOT NULL,
        observedAt timestamp NOT NULL,
        detectedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notifiedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY drop_events_fingerprint_unique (fingerprint),
        INDEX drop_events_user_detected_idx (userId, detectedAt),
        INDEX drop_events_monitor_detected_idx (monitorId, detectedAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_worker_leases (
        leaseKey varchar(64) NOT NULL PRIMARY KEY,
        holder varchar(64) NOT NULL,
        lockedUntil timestamp(3) NOT NULL,
        updatedAt timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_push_subscriptions (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        endpointHash varchar(64) NOT NULL,
        endpoint text NOT NULL,
        p256dh varchar(192) NOT NULL,
        auth varchar(64) NOT NULL,
        userAgent varchar(512) NULL,
        failureCount int NOT NULL DEFAULT 0,
        lastSuccessAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY drop_push_subscriptions_endpoint_unique (endpointHash),
        INDEX drop_push_subscriptions_user_idx (userId)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS drop_companion_tokens (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        name varchar(120) NOT NULL,
        tokenHash varchar(64) NOT NULL,
        lastUsedAt timestamp NULL,
        expiresAt timestamp NULL,
        revokedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY drop_companion_tokens_hash_unique (tokenHash),
        INDEX drop_companion_tokens_user_idx (userId, revokedAt)
      )
    `)
    );

    // Preserve alerts created by the old UI. The new worker can begin checking
    // them as soon as a compliant inventory provider is connected.
    try {
      await db.execute(
        sql.raw(`
        INSERT IGNORE INTO drop_monitors (
          legacyAlertId, userId, retailer, productName, productUrl, searchQuery,
          monitorMode, isActive, lastCheckedAt, lastTriggeredAt, createdAt, updatedAt
        )
        SELECT
          id, userId, retailer, productName, productUrl, productName,
          'always', isActive, NULL, lastTriggered, createdAt, updatedAt
        FROM drop_alerts
      `)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/drop_alerts.*doesn't exist/i.test(message)) throw error;
    }
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
