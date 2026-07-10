/** DB helpers for the Guess the Pokémon game. */
import { and, desc, eq, sql } from "drizzle-orm";
import { gameRounds, gameStats, users, type GameRound } from "../drizzle/schema";
import { getDb } from "./db";
import type { GuessFeedback } from "./lib/guessGame";

export async function getActiveRound(userId: number): Promise<GameRound | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.userId, userId), eq(gameRounds.status, "active")))
    .orderBy(desc(gameRounds.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRound(userId: number, targetId: number): Promise<GameRound | null> {
  const db = await getDb();
  if (!db) return null;
  // Abandon any previous active round
  await db
    .update(gameRounds)
    .set({ status: "lost", endedAt: new Date() })
    .where(and(eq(gameRounds.userId, userId), eq(gameRounds.status, "active")));
  await db.insert(gameRounds).values({ userId, targetId, guesses: [] });
  return getActiveRound(userId);
}

export async function saveRoundProgress(
  roundId: number,
  data: {
    attemptsUsed: number;
    guesses: GuessFeedback[];
    status?: "active" | "won" | "lost";
    roundScore?: number;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(gameRounds)
    .set({
      attemptsUsed: data.attemptsUsed,
      guesses: data.guesses,
      ...(data.status ? { status: data.status } : {}),
      ...(data.roundScore != null ? { roundScore: data.roundScore } : {}),
      ...(data.status && data.status !== "active" ? { endedAt: new Date() } : {}),
    })
    .where(eq(gameRounds.id, roundId));
}

export async function recordResult(
  userId: number,
  won: boolean,
  roundScore: number,
  attemptsUsed: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(gameStats)
    .values({
      userId,
      totalPoints: won ? roundScore : 0,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      streak: won ? 1 : 0,
      bestAttempts: won ? attemptsUsed : null,
    })
    .onDuplicateKeyUpdate({
      set: {
        totalPoints: sql`totalPoints + ${won ? roundScore : 0}`,
        wins: sql`wins + ${won ? 1 : 0}`,
        losses: sql`losses + ${won ? 0 : 1}`,
        streak: won ? sql`streak + 1` : 0,
        ...(won
          ? { bestAttempts: sql`LEAST(COALESCE(bestAttempts, 99), ${attemptsUsed})` }
          : {}),
      },
    });
}

export async function getStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(gameStats).where(eq(gameStats.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: gameStats.userId,
      totalPoints: gameStats.totalPoints,
      wins: gameStats.wins,
      losses: gameStats.losses,
      streak: gameStats.streak,
      bestAttempts: gameStats.bestAttempts,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(gameStats)
    .leftJoin(users, eq(users.id, gameStats.userId))
    .orderBy(desc(gameStats.totalPoints))
    .limit(limit);
}
