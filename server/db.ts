import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  binderCards,
  deckCards,
  decks,
  dropAlerts,
  InsertBinderCard,
  InsertDeck,
  InsertDeckCard,
  InsertDropAlert,
  InsertUser,
  priceCache,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod", "avatarUrl", "passwordHash"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(users).values(data);
  const result = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1);
  return result[0];
}

export async function getAdminUser() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function updateUserProfile(userId: number, data: { username?: string; bio?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Binder ───────────────────────────────────────────────────────────────────

export async function getBinderCards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(binderCards).where(eq(binderCards.userId, userId)).orderBy(desc(binderCards.addedAt));
}

export async function addBinderCard(data: InsertBinderCard) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(binderCards).values(data);
  return result;
}

export async function updateBinderCard(id: number, userId: number, data: Partial<InsertBinderCard>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(binderCards).set(data).where(and(eq(binderCards.id, id), eq(binderCards.userId, userId)));
}

export async function removeBinderCard(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(binderCards).where(and(eq(binderCards.id, id), eq(binderCards.userId, userId)));
}

export async function getBinderStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalCards: 0, totalValue: 0 };
  const cards = await db.select().from(binderCards).where(eq(binderCards.userId, userId));
  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  return { totalCards, cards };
}

// ─── Decks ────────────────────────────────────────────────────────────────────

export async function getUserDecks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(decks).where(eq(decks.userId, userId)).orderBy(desc(decks.updatedAt));
}

export async function getPublicDecks(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(decks).where(eq(decks.isPublic, true)).orderBy(desc(decks.updatedAt)).limit(limit);
}

export async function getDeckById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(decks).where(eq(decks.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createDeck(data: InsertDeck) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(decks).values(data);
  return result;
}

export async function updateDeck(id: number, userId: number, data: Partial<InsertDeck>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(decks).set({ ...data, updatedAt: new Date() }).where(and(eq(decks.id, id), eq(decks.userId, userId)));
}

export async function deleteDeck(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(deckCards).where(eq(deckCards.deckId, id));
  await db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId)));
}

export async function getDeckCards(deckId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deckCards).where(eq(deckCards.deckId, deckId));
}

export async function upsertDeckCards(deckId: number, cards: InsertDeckCard[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(deckCards).where(eq(deckCards.deckId, deckId));
  if (cards.length > 0) {
    await db.insert(deckCards).values(cards);
  }
}

// ─── Drop Alerts ──────────────────────────────────────────────────────────────

export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dropAlerts).where(eq(dropAlerts.userId, userId)).orderBy(desc(dropAlerts.createdAt));
}

export async function createAlert(data: InsertDropAlert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(dropAlerts).values(data);
  return result;
}

export async function updateAlert(id: number, userId: number, data: Partial<InsertDropAlert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(dropAlerts).set(data).where(and(eq(dropAlerts.id, id), eq(dropAlerts.userId, userId)));
}

export async function deleteAlert(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(dropAlerts).where(and(eq(dropAlerts.id, id), eq(dropAlerts.userId, userId)));
}

// ─── Price Cache ──────────────────────────────────────────────────────────────

export async function getPriceCacheByIds(cardIds: string[]) {
  const db = await getDb();
  if (!db || !cardIds.length) return [];
  // Fetch in batches to avoid huge IN clauses
  const results = [];
  for (const id of cardIds) {
    const rows = await db.select().from(priceCache).where(eq(priceCache.cardId, id)).limit(1);
    if (rows[0]) results.push(rows[0]);
  }
  return results;
}

export async function upsertPriceCache(cardId: string, prices: {
  tcgLow?: number; tcgMid?: number; tcgHigh?: number; tcgMarket?: number; tcgDirectLow?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const vals = {
    cardId,
    tcgLow: prices.tcgLow ?? null,
    tcgMid: prices.tcgMid ?? null,
    tcgHigh: prices.tcgHigh ?? null,
    tcgMarket: prices.tcgMarket ?? null,
    tcgDirectLow: prices.tcgDirectLow ?? null,
  };
  await db.insert(priceCache).values(vals as never).onDuplicateKeyUpdate({
    set: { ...vals, updatedAt: new Date() } as never,
  });
}

// ─── Auctions ─────────────────────────────────────────────────────────────────
import { auctions, auctionBids, auctionWatches, articles, comments } from "../drizzle/schema";
import type { InsertAuction } from "../drizzle/schema";

export interface AuctionFilters {
  conditions?: Array<"M" | "NM" | "SP" | "MP" | "HP" | "D">;
  language?: string;
  foilOnly?: boolean;
  promoOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "ending_soon" | "bids" | "price_asc" | "price_desc" | "newest";
  limit?: number;
}

export async function getActiveAuctions(filters: AuctionFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const priceCol = sql`COALESCE(${auctions.currentBidUsd}, ${auctions.startingBidUsd})`;
  const where = and(
    eq(auctions.status, "active"),
    filters.conditions?.length ? inArray(auctions.condition, filters.conditions) : undefined,
    filters.language ? eq(auctions.language, filters.language) : undefined,
    filters.foilOnly ? eq(auctions.isFoil, true) : undefined,
    filters.promoOnly ? eq(auctions.isPromo, true) : undefined,
    filters.minPrice !== undefined ? sql`${priceCol} >= ${filters.minPrice}` : undefined,
    filters.maxPrice !== undefined ? sql`${priceCol} <= ${filters.maxPrice}` : undefined,
  );

  const orderBy =
    filters.sort === "bids" ? desc(auctions.bidCount)
    : filters.sort === "price_asc" ? sql`${priceCol} ASC`
    : filters.sort === "price_desc" ? sql`${priceCol} DESC`
    : filters.sort === "newest" ? desc(auctions.createdAt)
    : auctions.endsAt; // ending_soon (default)

  return db.select().from(auctions)
    .where(where)
    .orderBy(orderBy as never)
    .limit(Math.min(filters.limit ?? 60, 120));
}

export async function getAuctionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return rows[0];
}

export async function createAuction(data: InsertAuction) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(auctions).values(data);
  return result;
}

export async function getAuctionBids(auctionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auctionBids)
    .where(eq(auctionBids.auctionId, auctionId))
    .orderBy(auctionBids.createdAt);
}

/**
 * Places a bid atomically: locks the auction row, re-validates state and
 * amount inside the transaction (prevents two simultaneous bids both
 * passing validation), then inserts the bid and updates the auction.
 * Returns the previous top bidder (for outbid notifications).
 */
export async function placeBid(auctionId: number, bidderId: number, amountUsd: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async (tx) => {
    const [auction] = await tx.select().from(auctions)
      .where(eq(auctions.id, auctionId)).for("update");

    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "active") throw new Error("Auction is not active");
    if (new Date(auction.endsAt) < new Date()) throw new Error("Auction has ended");
    if (auction.sellerId === bidderId) throw new Error("You cannot bid on your own auction");

    const currentBid = auction.currentBidUsd
      ? parseFloat(String(auction.currentBidUsd))
      : auction.startingBidUsd ? parseFloat(String(auction.startingBidUsd)) : 0;
    if (amountUsd <= currentBid) {
      throw new Error(`Bid must be higher than current bid of $${currentBid.toFixed(2)}`);
    }

    const [previousTop] = await tx.select().from(auctionBids)
      .where(eq(auctionBids.auctionId, auctionId))
      .orderBy(desc(auctionBids.amountUsd))
      .limit(1);

    await tx.insert(auctionBids).values({ auctionId, bidderId, amountUsd: amountUsd.toFixed(2) });
    await tx.update(auctions)
      .set({ currentBidUsd: amountUsd.toFixed(2), bidCount: sql`bidCount + 1` } as never)
      .where(eq(auctions.id, auctionId));

    return { previousTopBidderId: previousTop?.bidderId ?? null, newBid: amountUsd };
  });
}

// ─── Auction watches ──────────────────────────────────────────────────────────

export async function toggleAuctionWatch(auctionId: number, userId: number): Promise<{ watching: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(auctionWatches)
      .where(and(eq(auctionWatches.auctionId, auctionId), eq(auctionWatches.userId, userId)))
      .limit(1);
    if (existing[0]) {
      await tx.delete(auctionWatches).where(eq(auctionWatches.id, existing[0].id));
      await tx.update(auctions)
        .set({ watchCount: sql`GREATEST(watchCount - 1, 0)` } as never)
        .where(eq(auctions.id, auctionId));
      return { watching: false };
    }
    await tx.insert(auctionWatches).values({ auctionId, userId });
    await tx.update(auctions)
      .set({ watchCount: sql`watchCount + 1` } as never)
      .where(eq(auctions.id, auctionId));
    return { watching: true };
  });
}

export async function getUserWatchedAuctionIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ auctionId: auctionWatches.auctionId })
    .from(auctionWatches).where(eq(auctionWatches.userId, userId));
  return rows.map(r => r.auctionId);
}

// ─── Articles ─────────────────────────────────────────────────────────────────
import type { InsertArticle } from "../drizzle/schema";

export async function getPublishedArticles(limit = 20, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(articles)
    .where(eq(articles.isPublished, true))
    .orderBy(articles.publishedAt)
    .limit(limit);
  return query;
}

export async function getArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      id: articles.id,
      authorId: articles.authorId,
      title: articles.title,
      slug: articles.slug,
      subtitle: articles.subtitle,
      content: articles.content,
      coverImageUrl: articles.coverImageUrl,
      category: articles.category,
      tags: articles.tags,
      isPublished: articles.isPublished,
      viewCount: articles.viewCount,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      authorName: users.name,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(and(eq(articles.slug, slug), eq(articles.isPublished, true)))
    .limit(1);
  // Increment view count
  if (rows[0]) {
    await db.update(articles)
      .set({ viewCount: sql`viewCount + 1` } as never)
      .where(eq(articles.id, rows[0].id));
  }
  return rows[0];
}

export async function createArticle(data: InsertArticle) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(articles).values(data);
  return result;
}

/**
 * Idempotent upsert: inserts a new article or skips if slug already exists.
 * Returns { inserted: true } when created, { inserted: false } when duplicate.
 */
export async function upsertArticleBySlug(data: InsertArticle): Promise<{ inserted: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select({ id: articles.id }).from(articles)
    .where(eq(articles.slug, data.slug)).limit(1);
  if (existing.length > 0) return { inserted: false };
  await db.insert(articles).values(data);
  return { inserted: true };
}

// ─── Comments ─────────────────────────────────────────────────────────────────
import type { InsertComment } from "../drizzle/schema";

export async function getComments(entityType: string, entityId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments)
    .where(and(eq(comments.entityType, entityType as never), eq(comments.entityId, entityId)))
    .orderBy(comments.createdAt);
}

export async function addComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(comments).values(data);
  return result;
}

// ─── Listings (Sell a Card) ───────────────────────────────────────────────────
import { listings } from "../drizzle/schema";
import type { InsertListing } from "../drizzle/schema";

export async function createListing(data: InsertListing) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(listings).values(data);
  return result;
}

export async function getListingsByCard(cardId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings)
    .where(and(eq(listings.cardId, cardId), eq(listings.status, "active")))
    .orderBy(listings.priceUsd)
    .limit(50);
}

export async function getUserListings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings)
    .where(eq(listings.sellerId, userId))
    .orderBy(listings.createdAt);
}
