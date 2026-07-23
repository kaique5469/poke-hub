/** DB helpers for the Guess the Pokémon game. */
import { and, desc, eq, sql } from "drizzle-orm";
import {
  gameRounds,
  gameStats,
  users,
  type GameRound,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  DEFAULT_DIFFICULTY,
  isGameDifficulty,
  type GameDifficulty,
  type GuessFeedback,
} from "./lib/guessGame";
import { awardWeeklyPoints } from "./gameCompetitionDb";

export interface StoredRoundState {
  version: 2;
  difficulty: GameDifficulty;
  guesses: GuessFeedback[];
}

/**
 * Difficulty is stored in the existing JSON column to keep deployment
 * backward-compatible and avoid a database migration for live installations.
 */
export function decodeRoundState(value: unknown): {
  difficulty: GameDifficulty;
  guesses: GuessFeedback[];
} {
  if (Array.isArray(value)) {
    return {
      // Legacy rounds used 15 attempts, which matches the new easy mode.
      difficulty: "easy",
      guesses: value as GuessFeedback[],
    };
  }
  if (value && typeof value === "object") {
    const state = value as Partial<StoredRoundState>;
    return {
      difficulty: isGameDifficulty(state.difficulty)
        ? state.difficulty
        : DEFAULT_DIFFICULTY,
      guesses: Array.isArray(state.guesses) ? state.guesses : [],
    };
  }
  return { difficulty: DEFAULT_DIFFICULTY, guesses: [] };
}

function encodeRoundState(
  difficulty: GameDifficulty,
  guesses: GuessFeedback[]
): StoredRoundState {
  return { version: 2, difficulty, guesses };
}

export async function getActiveRound(
  userId: number
): Promise<GameRound | null> {
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

export async function createRound(
  userId: number,
  targetId: number,
  difficulty: GameDifficulty
): Promise<GameRound | null> {
  const db = await getDb();
  if (!db) return null;
  // Abandon any previous active round
  await db
    .update(gameRounds)
    .set({ status: "lost", endedAt: new Date() })
    .where(and(eq(gameRounds.userId, userId), eq(gameRounds.status, "active")));
  await db
    .insert(gameRounds)
    .values({ userId, targetId, guesses: encodeRoundState(difficulty, []) });
  return getActiveRound(userId);
}

export async function saveRoundProgress(
  roundId: number,
  data: {
    attemptsUsed: number;
    guesses: GuessFeedback[];
    difficulty: GameDifficulty;
    status?: "active" | "won" | "lost";
    roundScore?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(gameRounds)
    .set({
      attemptsUsed: data.attemptsUsed,
      guesses: encodeRoundState(data.difficulty, data.guesses),
      ...(data.status ? { status: data.status } : {}),
      ...(data.roundScore != null ? { roundScore: data.roundScore } : {}),
      ...(data.status && data.status !== "active"
        ? { endedAt: new Date() }
        : {}),
    })
    .where(eq(gameRounds.id, roundId));
}

export async function recordResult(
  userId: number,
  won: boolean,
  roundScore: number,
  attemptsUsed: number,
  difficulty: GameDifficulty
) {
  const db = await getDb();
  if (!db) return null;
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
          ? {
              bestAttempts: sql`LEAST(COALESCE(bestAttempts, 99), ${attemptsUsed})`,
            }
          : {}),
      },
    });
  return won ? awardWeeklyPoints(userId, difficulty, roundScore) : null;
}

export async function getStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.userId, userId))
    .limit(1);
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
