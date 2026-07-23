import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  gamePrizeClaims,
  gameRounds,
  gameWeeklyCompetitions,
  gameWeeklyScores,
  notifications,
  users,
  type GameWeeklyCompetition,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { GameDifficulty } from "./lib/guessGame";
import { ENV } from "./_core/env";
import { escapeHtml, notifyOwner, sendEmail } from "./_core/notification";

export const DAILY_SCORED_WIN_LIMIT = 10;
const BRAZIL_UTC_OFFSET_HOURS = -3;

export function getWeekWindow(date = new Date()) {
  const brazilWallClock = new Date(
    date.getTime() + BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000
  );
  const day = brazilWallClock.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const startsAt = new Date(
    Date.UTC(
      brazilWallClock.getUTCFullYear(),
      brazilWallClock.getUTCMonth(),
      brazilWallClock.getUTCDate()
    )
  );
  startsAt.setUTCDate(startsAt.getUTCDate() - daysSinceMonday);
  startsAt.setUTCHours(-BRAZIL_UTC_OFFSET_HOURS);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 7);
  const weekKey = new Date(
    startsAt.getTime() + BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);
  return { weekKey, startsAt, endsAt };
}

function getBrazilDayStart(date = new Date()) {
  const brazilWallClock = new Date(
    date.getTime() + BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000
  );
  return new Date(
    Date.UTC(
      brazilWallClock.getUTCFullYear(),
      brazilWallClock.getUTCMonth(),
      brazilWallClock.getUTCDate(),
      -BRAZIL_UTC_OFFSET_HOURS
    )
  );
}

export async function awardWeeklyPoints(
  userId: number,
  difficulty: GameDifficulty,
  points: number
) {
  const db = await getDb();
  const window = getWeekWindow();
  if (!db) return { awarded: false, reason: "unavailable", ...window };
  const [daily] = await db
    .select({ wins: count() })
    .from(gameRounds)
    .where(
      and(
        eq(gameRounds.userId, userId),
        eq(gameRounds.status, "won"),
        gte(gameRounds.endedAt, getBrazilDayStart())
      )
    );
  const dailyWins = Number(daily?.wins ?? 0);
  if (dailyWins > DAILY_SCORED_WIN_LIMIT) {
    return {
      awarded: false,
      reason: "daily_limit",
      dailyWins,
      dailyLimit: DAILY_SCORED_WIN_LIMIT,
      ...window,
    };
  }
  const now = new Date();
  await db
    .insert(gameWeeklyScores)
    .values({
      userId,
      weekKey: window.weekKey,
      points,
      wins: 1,
      hardWins: difficulty === "hard" ? 1 : 0,
      scoredRounds: 1,
      lastScoredAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        points: sql`${gameWeeklyScores.points} + ${points}`,
        wins: sql`${gameWeeklyScores.wins} + 1`,
        hardWins:
          difficulty === "hard"
            ? sql`${gameWeeklyScores.hardWins} + 1`
            : sql`${gameWeeklyScores.hardWins}`,
        scoredRounds: sql`${gameWeeklyScores.scoredRounds} + 1`,
        lastScoredAt: now,
      },
    });
  return {
    awarded: true,
    points,
    dailyWins,
    dailyLimit: DAILY_SCORED_WIN_LIMIT,
    ...window,
  };
}

async function currentCompetition(weekKey: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(gameWeeklyCompetitions)
    .where(eq(gameWeeklyCompetitions.weekKey, weekKey))
    .limit(1);
  return row ?? null;
}

export async function getWeeklyLeaderboard(limit = 20, userId?: number) {
  await finalizeExpiredCompetitions();
  const db = await getDb();
  const window = getWeekWindow();
  if (!db)
    return {
      ...window,
      dailyLimit: DAILY_SCORED_WIN_LIMIT,
      competition: null,
      rows: [],
      myRank: null,
    };
  const allRows = await db
    .select({
      userId: gameWeeklyScores.userId,
      points: gameWeeklyScores.points,
      wins: gameWeeklyScores.wins,
      hardWins: gameWeeklyScores.hardWins,
      scoredRounds: gameWeeklyScores.scoredRounds,
      lastScoredAt: gameWeeklyScores.lastScoredAt,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(gameWeeklyScores)
    .leftJoin(users, eq(users.id, gameWeeklyScores.userId))
    .where(eq(gameWeeklyScores.weekKey, window.weekKey))
    .orderBy(
      desc(gameWeeklyScores.points),
      desc(gameWeeklyScores.hardWins),
      asc(gameWeeklyScores.lastScoredAt)
    )
    .limit(100);
  const competition = await currentCompetition(window.weekKey);
  const visibleCompetition =
    competition?.status === "active" || competition?.status === "closed"
      ? competition
      : null;
  const myIndex = userId ? allRows.findIndex(row => row.userId === userId) : -1;
  return {
    ...window,
    dailyLimit: DAILY_SCORED_WIN_LIMIT,
    competition: visibleCompetition,
    rows: allRows.slice(0, limit),
    myRank:
      myIndex >= 0 ? { position: myIndex + 1, ...allRows[myIndex] } : null,
  };
}

export async function getMyPrizeClaim(userId: number) {
  await finalizeExpiredCompetitions();
  const db = await getDb();
  if (!db) return null;
  const [competition] = await db
    .select()
    .from(gameWeeklyCompetitions)
    .where(
      and(
        eq(gameWeeklyCompetitions.winnerUserId, userId),
        inArray(gameWeeklyCompetitions.status, ["closed", "fulfilled"])
      )
    )
    .orderBy(desc(gameWeeklyCompetitions.endsAt))
    .limit(1);
  if (!competition) return null;
  const [claim] = await db
    .select()
    .from(gamePrizeClaims)
    .where(eq(gamePrizeClaims.competitionId, competition.id))
    .limit(1);
  return {
    competition,
    claim: claim
      ? {
          id: claim.id,
          status: claim.status,
          trackingCode: claim.trackingCode,
          claimedAt: claim.claimedAt,
          shippedAt: claim.shippedAt,
        }
      : null,
    canClaim:
      !claim &&
      !!competition.claimDeadline &&
      competition.claimDeadline > new Date(),
  };
}

export interface PrizeClaimInput {
  fullName: string;
  email: string;
  phone?: string;
  postalCode: string;
  addressLine1: string;
  addressNumber: string;
  addressLine2?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function submitPrizeClaim(userId: number, input: PrizeClaimInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const prize = await getMyPrizeClaim(userId);
  if (!prize?.canClaim)
    throw new Error("This prize is not available for claim.");
  await db.insert(gamePrizeClaims).values({
    competitionId: prize.competition.id,
    userId,
    ...input,
    state: input.state.toUpperCase(),
    country: "BR",
  });
  await notifyOwner({
    title: `Weekly prize claimed — ${prize.competition.prizeTitle}`,
    content: `${input.fullName} claimed the weekly prize. Open ${ENV.appUrl || "RarityGrid"}/admin/game to review the protected shipping details.`,
  });
  return { success: true };
}

export interface CompetitionInput {
  weekOffset: 0 | 1;
  prizeTitle: string;
  prizeDescription?: string;
  prizeImageUrl?: string;
  rulesUrl: string;
  authorizationReference: string;
}

export async function activateCompetition(input: CompetitionInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + input.weekOffset * 7);
  const window = getWeekWindow(base);
  if (input.weekOffset === 0) {
    const [existing] = await db
      .select({ total: count() })
      .from(gameWeeklyScores)
      .where(eq(gameWeeklyScores.weekKey, window.weekKey));
    if (Number(existing?.total ?? 0) > 0) {
      throw new Error(
        "The current ranking already has scores. Activate the physical prize for next week so every participant starts under the same published rules."
      );
    }
  }
  await db
    .insert(gameWeeklyCompetitions)
    .values({
      weekKey: window.weekKey,
      prizeTitle: input.prizeTitle,
      prizeDescription: input.prizeDescription,
      prizeImageUrl: input.prizeImageUrl,
      rulesUrl: input.rulesUrl,
      authorizationReference: input.authorizationReference,
      eligibleCountry: "BR",
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      status: "active",
    })
    .onDuplicateKeyUpdate({
      set: {
        prizeTitle: input.prizeTitle,
        prizeDescription: input.prizeDescription,
        prizeImageUrl: input.prizeImageUrl,
        rulesUrl: input.rulesUrl,
        authorizationReference: input.authorizationReference,
        eligibleCountry: "BR",
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        status: "active",
      },
    });
  return currentCompetition(window.weekKey);
}

export async function getCompetitionAdminOverview() {
  await finalizeExpiredCompetitions();
  const db = await getDb();
  if (!db) return { competitions: [], claims: [] };
  const competitions = await db
    .select({
      competition: gameWeeklyCompetitions,
      winnerName: users.name,
      winnerEmail: users.email,
    })
    .from(gameWeeklyCompetitions)
    .leftJoin(users, eq(users.id, gameWeeklyCompetitions.winnerUserId))
    .orderBy(desc(gameWeeklyCompetitions.startsAt))
    .limit(20);
  const claims = await db
    .select({ claim: gamePrizeClaims, competition: gameWeeklyCompetitions })
    .from(gamePrizeClaims)
    .innerJoin(
      gameWeeklyCompetitions,
      eq(gameWeeklyCompetitions.id, gamePrizeClaims.competitionId)
    )
    .orderBy(desc(gamePrizeClaims.claimedAt));
  return { competitions, claims };
}

export async function markPrizeShipped(claimId: number, trackingCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db
    .select({ claim: gamePrizeClaims, competition: gameWeeklyCompetitions })
    .from(gamePrizeClaims)
    .innerJoin(
      gameWeeklyCompetitions,
      eq(gameWeeklyCompetitions.id, gamePrizeClaims.competitionId)
    )
    .where(eq(gamePrizeClaims.id, claimId))
    .limit(1);
  if (!row) throw new Error("Claim not found");
  await db
    .update(gamePrizeClaims)
    .set({ status: "shipped", trackingCode, shippedAt: new Date() })
    .where(eq(gamePrizeClaims.id, claimId));
  await db
    .update(gameWeeklyCompetitions)
    .set({ status: "fulfilled" })
    .where(eq(gameWeeklyCompetitions.id, row.competition.id));
  await db.insert(notifications).values({
    userId: row.claim.userId,
    type: "order_update",
    title: "Your weekly prize is on the way",
    message: `Tracking code: ${trackingCode}`,
    entityType: "game_prize",
    entityId: String(row.competition.id),
  });
  await sendEmail({
    to: row.claim.email,
    subject: "Your RarityGrid weekly prize is on the way",
    text: `Your prize has shipped. Tracking code: ${trackingCode}`,
    html: `<p>Your prize has shipped.</p><p><strong>Tracking code:</strong> ${escapeHtml(trackingCode)}</p>`,
  });
  return { success: true };
}

export async function finalizeExpiredCompetitions() {
  const db = await getDb();
  if (!db) return [];
  const expired = await db
    .select()
    .from(gameWeeklyCompetitions)
    .where(
      and(
        eq(gameWeeklyCompetitions.status, "active"),
        lte(gameWeeklyCompetitions.endsAt, new Date())
      )
    );
  const finalized: GameWeeklyCompetition[] = [];
  for (const competition of expired) {
    const [winner] = await db
      .select({
        userId: gameWeeklyScores.userId,
        points: gameWeeklyScores.points,
        name: users.name,
        email: users.email,
      })
      .from(gameWeeklyScores)
      .leftJoin(users, eq(users.id, gameWeeklyScores.userId))
      .where(eq(gameWeeklyScores.weekKey, competition.weekKey))
      .orderBy(
        desc(gameWeeklyScores.points),
        desc(gameWeeklyScores.hardWins),
        asc(gameWeeklyScores.lastScoredAt)
      )
      .limit(1);
    const claimDeadline = new Date(competition.endsAt);
    claimDeadline.setUTCDate(claimDeadline.getUTCDate() + 7);
    const [updated] = await db
      .update(gameWeeklyCompetitions)
      .set({
        status: "closed",
        winnerUserId: winner?.userId ?? null,
        finalizedAt: new Date(),
        claimDeadline: winner ? claimDeadline : null,
      })
      .where(
        and(
          eq(gameWeeklyCompetitions.id, competition.id),
          eq(gameWeeklyCompetitions.status, "active")
        )
      );
    if (
      Number((updated as { affectedRows?: number }).affectedRows ?? 0) === 0
    ) {
      continue;
    }
    if (winner) {
      await db.insert(notifications).values({
        userId: winner.userId,
        type: "order_update",
        title: "You won the RarityGrid Weekly Arena",
        message: `Claim ${competition.prizeTitle} in the game page within 7 days.`,
        entityType: "game_prize",
        entityId: String(competition.id),
      });
      if (winner.email) {
        const claimUrl = `${ENV.appUrl || "https://raritygrid.com"}/game#claim-prize`;
        await sendEmail({
          to: winner.email,
          subject: "You won the RarityGrid Weekly Arena",
          text: `Congratulations! You won ${competition.prizeTitle} with ${winner.points} points. Claim it within 7 days: ${claimUrl}`,
          html: `<h1>Congratulations, ${escapeHtml(winner.name || "Trainer")}!</h1><p>You won <strong>${escapeHtml(competition.prizeTitle)}</strong> with ${winner.points} points.</p><p><a href="${claimUrl}">Claim your prize within 7 days</a>.</p>`,
        });
      }
      await notifyOwner({
        title: `Weekly Arena winner — ${winner.name || winner.userId}`,
        content: `${winner.name || "Trainer"} won ${competition.prizeTitle} with ${winner.points} points. The winner has 7 days to submit shipping details.`,
      });
    }
    finalized.push(competition);
  }
  return finalized;
}
