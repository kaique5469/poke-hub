import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

/**
 * Railway historically deployed this project without automatically running
 * Drizzle migrations. Keep the Phase 3 tables self-bootstrapping so a normal
 * main-branch deploy cannot leave the market page broken.
 */
export function ensureMarketPulseSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS market_events (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        sessionId varchar(64) NOT NULL,
        userId int NULL,
        eventType enum('search','card_view','watchlist_add','watchlist_remove') NOT NULL,
        cardId varchar(64) NULL,
        cardName varchar(256) NULL,
        setId varchar(64) NULL,
        setName varchar(256) NULL,
        imageUrl text NULL,
        query varchar(128) NULL,
        metadata json NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX market_events_type_created_idx (eventType, createdAt),
        INDEX market_events_card_created_idx (cardId, createdAt),
        INDEX market_events_session_type_created_idx (sessionId, eventType, createdAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS market_price_snapshots (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        cardId varchar(64) NOT NULL,
        cardName varchar(256) NOT NULL,
        setId varchar(64) NULL,
        setName varchar(256) NULL,
        imageUrl text NULL,
        source varchar(64) NOT NULL,
        variant varchar(64) NOT NULL DEFAULT 'market',
        \`condition\` varchar(16) NOT NULL DEFAULT 'NM',
        currency varchar(8) NOT NULL DEFAULT 'USD',
        marketPriceUsd decimal(12,2) NOT NULL,
        lowPriceUsd decimal(12,2) NULL,
        recordedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX market_snapshots_card_recorded_idx (cardId, recordedAt),
        INDEX market_snapshots_recorded_idx (recordedAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS market_watchlist (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        cardId varchar(64) NOT NULL,
        cardName varchar(256) NOT NULL,
        setId varchar(64) NULL,
        setName varchar(256) NULL,
        imageUrl text NULL,
        targetPriceUsd decimal(12,2) NULL,
        isActive boolean NOT NULL DEFAULT true,
        lastNotifiedAt timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY market_watchlist_user_card_unique (userId, cardId),
        INDEX market_watchlist_card_active_idx (cardId, isActive)
      )
    `)
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
