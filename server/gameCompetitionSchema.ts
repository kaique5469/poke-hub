import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ready: Promise<void> | null = null;

/** Railway deployments do not run Drizzle migrations automatically. */
export function ensureGameCompetitionSchema() {
  if (ready) return ready;
  ready = (async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS game_weekly_scores (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        userId int NOT NULL,
        weekKey varchar(10) NOT NULL,
        points int NOT NULL DEFAULT 0,
        wins int NOT NULL DEFAULT 0,
        hardWins int NOT NULL DEFAULT 0,
        scoredRounds int NOT NULL DEFAULT 0,
        lastScoredAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY game_weekly_scores_user_week_unique (userId, weekKey),
        INDEX game_weekly_scores_rank_idx (weekKey, points, hardWins, lastScoredAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS game_weekly_competitions (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        weekKey varchar(10) NOT NULL UNIQUE,
        prizeTitle varchar(160) NOT NULL,
        prizeDescription text NULL,
        prizeImageUrl text NULL,
        rulesUrl text NOT NULL,
        authorizationReference varchar(160) NOT NULL,
        eligibleCountry varchar(8) NOT NULL DEFAULT 'BR,US',
        status enum('draft','active','closed','fulfilled','cancelled') NOT NULL DEFAULT 'draft',
        startsAt timestamp NOT NULL,
        endsAt timestamp NOT NULL,
        winnerUserId int NULL,
        finalizedAt timestamp NULL,
        claimDeadline timestamp NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX game_weekly_competitions_status_end_idx (status, endsAt)
      )
    `)
    );
    await db.execute(
      sql.raw(`
      ALTER TABLE game_weekly_competitions
      MODIFY COLUMN eligibleCountry varchar(8) NOT NULL DEFAULT 'BR,US'
    `)
    );
    await db.execute(
      sql.raw(`
      CREATE TABLE IF NOT EXISTS game_prize_claims (
        id int AUTO_INCREMENT NOT NULL PRIMARY KEY,
        competitionId int NOT NULL UNIQUE,
        userId int NOT NULL,
        fullName varchar(160) NOT NULL,
        email varchar(320) NOT NULL,
        phone varchar(32) NULL,
        postalCode varchar(16) NOT NULL,
        addressLine1 varchar(200) NOT NULL,
        addressNumber varchar(32) NOT NULL,
        addressLine2 varchar(160) NULL,
        neighborhood varchar(120) NOT NULL,
        city varchar(120) NOT NULL,
        state varchar(2) NOT NULL,
        country varchar(2) NOT NULL DEFAULT 'BR',
        status enum('submitted','shipped','delivered') NOT NULL DEFAULT 'submitted',
        trackingCode varchar(120) NULL,
        claimedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        shippedAt timestamp NULL,
        deliveredAt timestamp NULL,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX game_prize_claims_status_idx (status, claimedAt)
      )
    `)
    );
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
