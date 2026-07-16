import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  binderCards,
  listings,
  marketEvents,
  marketPriceSnapshots,
  marketWatchlist,
  notifications,
  orders,
  type InsertMarketPriceSnapshot,
} from "../drizzle/schema";
import { getDb } from "./db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MarketEventKind =
  "search" | "card_view" | "watchlist_add" | "watchlist_remove";

export type MarketCardIdentity = {
  cardId: string;
  cardName: string;
  setId?: string | null;
  setName?: string | null;
  imageUrl?: string | null;
};

type SnapshotRow = typeof marketPriceSnapshots.$inferSelect;

const money = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

function changeBetween(current: number, baseline: number) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0)
    return null;
  return ((current - baseline) / baseline) * 100;
}

function baselineFor(
  history: SnapshotRow[],
  days: number,
  now = Date.now()
): SnapshotRow | null {
  if (history.length < 2) return null;
  const target = now - days * DAY_MS;
  const minimumSpan = days === 1 ? 18 * 60 * 60 * 1000 : days * DAY_MS * 0.9;
  const first = history[0];
  const latest = history[history.length - 1];
  if (
    new Date(latest.recordedAt).getTime() -
      new Date(first.recordedAt).getTime() <
    minimumSpan
  )
    return null;

  let selected = first;
  for (const row of history) {
    if (new Date(row.recordedAt).getTime() <= target) selected = row;
    else break;
  }
  return selected;
}

function groupSnapshots(rows: SnapshotRow[]) {
  const grouped = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.cardId) ?? [];
    existing.push(row);
    grouped.set(row.cardId, existing);
  }
  for (const history of Array.from(grouped.values())) {
    history.sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }
  return grouped;
}

/**
 * A source or variant change can create a discontinuity that looks like a
 * market move but is only a methodology change. All comparisons and charts
 * therefore use the same source/variant series as the latest observation.
 */
export function selectComparableMarketSeries<
  T extends {
    source: string;
    variant: string;
    condition: string;
    currency: string;
  },
>(history: T[]): T[] {
  const latest = history.at(-1);
  if (!latest) return [];
  return history.filter(
    row =>
      row.source === latest.source &&
      row.variant === latest.variant &&
      row.condition === latest.condition &&
      row.currency === latest.currency
  );
}

export async function recordMarketEvent(data: {
  sessionId: string;
  userId?: number | null;
  eventType: MarketEventKind;
  card?: MarketCardIdentity | null;
  query?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const db = await getDb();
  if (!db) return { recorded: false };

  const query = data.query?.trim().slice(0, 128) || null;
  const dedupeMinutes = data.eventType === "search" ? 10 : 30;
  const cutoff = new Date(Date.now() - dedupeMinutes * 60_000);
  const duplicate = await db
    .select({ id: marketEvents.id })
    .from(marketEvents)
    .where(
      and(
        eq(marketEvents.sessionId, data.sessionId),
        eq(marketEvents.eventType, data.eventType),
        gte(marketEvents.createdAt, cutoff),
        data.card?.cardId
          ? eq(marketEvents.cardId, data.card.cardId)
          : query
            ? eq(marketEvents.query, query)
            : undefined
      )
    )
    .limit(1);
  if (duplicate[0]) return { recorded: false };

  await db.insert(marketEvents).values({
    sessionId: data.sessionId.slice(0, 64),
    userId: data.userId ?? null,
    eventType: data.eventType,
    cardId: data.card?.cardId ?? null,
    cardName: data.card?.cardName ?? null,
    setId: data.card?.setId ?? null,
    setName: data.card?.setName ?? null,
    imageUrl: data.card?.imageUrl ?? null,
    query,
    metadata: data.metadata ?? null,
  });
  return { recorded: true };
}

export async function insertMarketSnapshots(
  snapshots: InsertMarketPriceSnapshot[],
  minimumIntervalHours = 6
) {
  const db = await getDb();
  if (!db || snapshots.length === 0) return 0;
  const cardIds = Array.from(new Set(snapshots.map(row => row.cardId)));
  const cutoff = new Date(Date.now() - minimumIntervalHours * 60 * 60 * 1000);
  const recent = await db
    .select({
      cardId: marketPriceSnapshots.cardId,
      source: marketPriceSnapshots.source,
    })
    .from(marketPriceSnapshots)
    .where(
      and(
        inArray(marketPriceSnapshots.cardId, cardIds),
        gte(marketPriceSnapshots.recordedAt, cutoff)
      )
    );
  const existing = new Set(recent.map(row => `${row.cardId}:${row.source}`));
  const fresh = snapshots.filter(
    row => !existing.has(`${row.cardId}:${row.source}`)
  );
  if (fresh.length === 0) return 0;
  await db.insert(marketPriceSnapshots).values(fresh);
  return fresh.length;
}

export async function getTrackedMarketCards(limit = 100) {
  const db = await getDb();
  if (!db) return [] as MarketCardIdentity[];
  const cutoff = new Date(Date.now() - 30 * DAY_MS);
  const [watches, events, snapshots] = await Promise.all([
    db
      .select({
        cardId: marketWatchlist.cardId,
        cardName: marketWatchlist.cardName,
        setId: marketWatchlist.setId,
        setName: marketWatchlist.setName,
        imageUrl: marketWatchlist.imageUrl,
      })
      .from(marketWatchlist)
      .where(eq(marketWatchlist.isActive, true))
      .orderBy(desc(marketWatchlist.updatedAt))
      .limit(limit),
    db
      .select({
        cardId: marketEvents.cardId,
        cardName: marketEvents.cardName,
        setId: marketEvents.setId,
        setName: marketEvents.setName,
        imageUrl: marketEvents.imageUrl,
      })
      .from(marketEvents)
      .where(
        and(isNotNull(marketEvents.cardId), gte(marketEvents.createdAt, cutoff))
      )
      .orderBy(desc(marketEvents.createdAt))
      .limit(limit * 3),
    db
      .select({
        cardId: marketPriceSnapshots.cardId,
        cardName: marketPriceSnapshots.cardName,
        setId: marketPriceSnapshots.setId,
        setName: marketPriceSnapshots.setName,
        imageUrl: marketPriceSnapshots.imageUrl,
      })
      .from(marketPriceSnapshots)
      .orderBy(desc(marketPriceSnapshots.recordedAt))
      .limit(limit * 2),
  ]);

  const cards = new Map<string, MarketCardIdentity>();
  for (const row of [...watches, ...events, ...snapshots]) {
    if (!row.cardId || cards.has(row.cardId)) continue;
    cards.set(row.cardId, {
      cardId: row.cardId,
      cardName: row.cardName || row.cardId,
      setId: row.setId,
      setName: row.setName,
      imageUrl: row.imageUrl,
    });
    if (cards.size >= limit) break;
  }
  return Array.from(cards.values());
}

export async function processMarketPriceAlerts(
  latest: Array<{ cardId: string; cardName: string; price: number }>
) {
  const db = await getDb();
  if (!db || latest.length === 0) return 0;
  const cardIds = latest.map(row => row.cardId);
  const watches = await db
    .select()
    .from(marketWatchlist)
    .where(
      and(
        inArray(marketWatchlist.cardId, cardIds),
        eq(marketWatchlist.isActive, true),
        isNotNull(marketWatchlist.targetPriceUsd)
      )
    );
  const prices = new Map(latest.map(row => [row.cardId, row]));
  let triggered = 0;
  for (const watch of watches) {
    const current = prices.get(watch.cardId);
    const target = money(watch.targetPriceUsd);
    if (!current || target <= 0 || current.price > target) continue;
    // Buy targets are intentionally one-shot. Editing the target resets
    // lastNotifiedAt and arms it again; this avoids a daily notification loop.
    if (watch.lastNotifiedAt) continue;
    await db.insert(notifications).values({
      userId: watch.userId,
      type: "price_alert",
      title: `${watch.cardName} reached your target`,
      message: `Current market price: $${current.price.toFixed(2)} · Your target: $${target.toFixed(2)}.`,
      entityType: "card",
      entityId: watch.cardId,
    });
    await db
      .update(marketWatchlist)
      .set({ lastNotifiedAt: new Date() })
      .where(eq(marketWatchlist.id, watch.id));
    triggered += 1;
  }
  return triggered;
}

export async function toggleMarketWatch(
  userId: number,
  card: MarketCardIdentity
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(marketWatchlist)
    .where(
      and(
        eq(marketWatchlist.userId, userId),
        eq(marketWatchlist.cardId, card.cardId)
      )
    )
    .limit(1);
  if (existing[0]) {
    const watching = !existing[0].isActive;
    await db
      .update(marketWatchlist)
      .set({
        isActive: watching,
        cardName: card.cardName,
        setId: card.setId ?? null,
        setName: card.setName ?? null,
        imageUrl: card.imageUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(marketWatchlist.id, existing[0].id));
    return { watching };
  }
  await db.insert(marketWatchlist).values({
    userId,
    cardId: card.cardId,
    cardName: card.cardName,
    setId: card.setId ?? null,
    setName: card.setName ?? null,
    imageUrl: card.imageUrl ?? null,
  });
  return { watching: true };
}

export async function updateMarketWatchTarget(
  userId: number,
  cardId: string,
  targetPriceUsd: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(marketWatchlist)
    .set({
      targetPriceUsd: targetPriceUsd == null ? null : targetPriceUsd.toFixed(2),
      lastNotifiedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketWatchlist.userId, userId),
        eq(marketWatchlist.cardId, cardId)
      )
    );
  return { success: true };
}

export async function isCardWatched(userId: number, cardId: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: marketWatchlist.id })
    .from(marketWatchlist)
    .where(
      and(
        eq(marketWatchlist.userId, userId),
        eq(marketWatchlist.cardId, cardId),
        eq(marketWatchlist.isActive, true)
      )
    )
    .limit(1);
  return Boolean(rows[0]);
}

async function snapshotsSince(days = 45) {
  const db = await getDb();
  if (!db) return [] as SnapshotRow[];
  return db
    .select()
    .from(marketPriceSnapshots)
    .where(
      gte(marketPriceSnapshots.recordedAt, new Date(Date.now() - days * DAY_MS))
    )
    .orderBy(marketPriceSnapshots.recordedAt)
    .limit(12_000);
}

export async function getLatestMarketSnapshotAt() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      recordedAt: sql<Date | null>`max(${marketPriceSnapshots.recordedAt})`,
    })
    .from(marketPriceSnapshots);
  return rows[0]?.recordedAt ? new Date(rows[0].recordedAt) : null;
}

function marketIndexFrom(grouped: Map<string, SnapshotRow[]>) {
  const points = new Map<string, number[]>();
  for (const allHistory of Array.from(grouped.values())) {
    const history = selectComparableMarketSeries(allHistory);
    const baseline = money(history[0]?.marketPriceUsd);
    if (baseline <= 0) continue;
    const daily = new Map<string, SnapshotRow>();
    for (const row of history) {
      const date = new Date(row.recordedAt).toISOString().slice(0, 10);
      daily.set(date, row);
    }
    for (const [date, row] of daily) {
      const values = points.get(date) ?? [];
      values.push((money(row.marketPriceUsd) / baseline) * 100);
      points.set(date, values);
    }
  }
  return Array.from(points.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
          2
        )
      ),
      cards: values.length,
    }));
}

export async function getMarketOverview(periodDays: 1 | 7 | 30) {
  const db = await getDb();
  if (!db) {
    return {
      summary: {
        trackedCards: 0,
        searches24h: 0,
        views24h: 0,
        sales30d: 0,
        volume30d: 0,
        lastUpdated: null,
      },
      gainers: [],
      losers: [],
      tracked: [],
      demand: [],
      mostWatched: [],
      topSales: [],
      recentSales: [],
      marketIndex: [],
      methodology: {
        price: "Scrydex raw NM market price with TCGPlayer fallback",
        demand: "TCG Arena searches and card views",
        sales: "Completed TCG Arena marketplace orders",
      },
    };
  }

  const now = Date.now();
  const rows = await snapshotsSince(45);
  const grouped = groupSnapshots(rows);
  const cards = Array.from(grouped.values()).map(allHistory => {
    const history = selectComparableMarketSeries(allHistory);
    const latest = history[history.length - 1];
    const baseline = baselineFor(history, periodDays, now);
    const currentPrice = money(latest.marketPriceUsd);
    return {
      cardId: latest.cardId,
      cardName: latest.cardName,
      setId: latest.setId,
      setName: latest.setName,
      imageUrl: latest.imageUrl,
      price: currentPrice,
      low: latest.lowPriceUsd == null ? null : money(latest.lowPriceUsd),
      source: latest.source,
      variant: latest.variant,
      updatedAt: iso(latest.recordedAt),
      changePercent: baseline
        ? changeBetween(currentPrice, money(baseline.marketPriceUsd))
        : null,
      baselinePrice: baseline ? money(baseline.marketPriceUsd) : null,
      baselineAt: baseline ? iso(baseline.recordedAt) : null,
      sparkline: history.slice(-16).map(point => ({
        date: iso(point.recordedAt),
        price: money(point.marketPriceUsd),
      })),
    };
  });
  const comparable = cards.filter(
    card => card.changePercent != null && Number.isFinite(card.changePercent)
  );
  const gainers = comparable
    .filter(card => (card.changePercent ?? 0) > 0)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
    .slice(0, 8);
  const losers = comparable
    .filter(card => (card.changePercent ?? 0) < 0)
    .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
    .slice(0, 8);
  const tracked = [...cards]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime()
    )
    .slice(0, 12);

  const dayAgo = new Date(now - DAY_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);
  const periodCutoff = new Date(now - periodDays * DAY_MS);
  const paidOrderWhere = and(
    eq(orders.paymentStatus, "paid"),
    gte(orders.createdAt, monthAgo)
  );

  const [
    eventSummary,
    salesSummary,
    demandRows,
    watchedRows,
    salesRows,
    recentSales,
  ] = await Promise.all([
    db
      .select({
        eventType: marketEvents.eventType,
        count: sql<number>`count(*)`,
      })
      .from(marketEvents)
      .where(gte(marketEvents.createdAt, dayAgo))
      .groupBy(marketEvents.eventType),
    db
      .select({
        sales: sql<number>`coalesce(sum(${orders.quantity}), 0)`,
        volume: sql<string>`coalesce(sum(${orders.totalUsd}), 0)`,
      })
      .from(orders)
      .innerJoin(listings, eq(orders.listingId, listings.id))
      .where(paidOrderWhere),
    db
      .select({
        cardId: marketEvents.cardId,
        cardName: marketEvents.cardName,
        setName: marketEvents.setName,
        imageUrl: marketEvents.imageUrl,
        searches: sql<number>`sum(case when ${marketEvents.eventType} = 'search' then 1 else 0 end)`,
        views: sql<number>`sum(case when ${marketEvents.eventType} = 'card_view' then 1 else 0 end)`,
      })
      .from(marketEvents)
      .where(
        and(
          isNotNull(marketEvents.cardId),
          gte(marketEvents.createdAt, periodCutoff)
        )
      )
      .groupBy(
        marketEvents.cardId,
        marketEvents.cardName,
        marketEvents.setName,
        marketEvents.imageUrl
      )
      .orderBy(
        desc(
          sql`sum(case when ${marketEvents.eventType} = 'search' then 3 else 1 end)`
        )
      )
      .limit(10),
    db
      .select({
        cardId: marketWatchlist.cardId,
        cardName: marketWatchlist.cardName,
        setName: marketWatchlist.setName,
        imageUrl: marketWatchlist.imageUrl,
        watchers: sql<number>`count(*)`,
      })
      .from(marketWatchlist)
      .where(eq(marketWatchlist.isActive, true))
      .groupBy(
        marketWatchlist.cardId,
        marketWatchlist.cardName,
        marketWatchlist.setName,
        marketWatchlist.imageUrl
      )
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({
        cardId: listings.cardId,
        cardName: listings.cardName,
        setName: listings.setName,
        imageUrl: listings.imageUrl,
        units: sql<number>`sum(${orders.quantity})`,
        volume: sql<string>`sum(${orders.totalUsd})`,
      })
      .from(orders)
      .innerJoin(listings, eq(orders.listingId, listings.id))
      .where(paidOrderWhere)
      .groupBy(
        listings.cardId,
        listings.cardName,
        listings.setName,
        listings.imageUrl
      )
      .orderBy(desc(sql`sum(${orders.quantity})`))
      .limit(10),
    db
      .select({
        orderId: orders.id,
        cardId: listings.cardId,
        cardName: listings.cardName,
        setName: listings.setName,
        imageUrl: listings.imageUrl,
        quantity: orders.quantity,
        totalUsd: orders.totalUsd,
        soldAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(listings, eq(orders.listingId, listings.id))
      .where(paidOrderWhere)
      .orderBy(desc(orders.createdAt))
      .limit(8),
  ]);

  const eventCounts = new Map(
    eventSummary.map(row => [row.eventType, Number(row.count)])
  );
  const prices = new Map(cards.map(card => [card.cardId, card]));
  const attachPrice = <
    T extends {
      cardId: string | null;
      cardName?: string | null;
      setName?: string | null;
      imageUrl?: string | null;
    },
  >(
    row: T
  ) => {
    const verified = row.cardId ? prices.get(row.cardId) : undefined;
    return {
      ...row,
      // Public analytics payloads are never trusted as card metadata. Once a
      // card is validated by a price source, use that canonical identity.
      cardName: verified?.cardName ?? row.cardName ?? null,
      setName: verified?.setName ?? row.setName ?? null,
      imageUrl: verified?.imageUrl ?? row.imageUrl ?? null,
      currentPrice: verified?.price ?? null,
      changePercent: verified?.changePercent ?? null,
    };
  };

  return {
    summary: {
      trackedCards: cards.length,
      searches24h: eventCounts.get("search") ?? 0,
      views24h: eventCounts.get("card_view") ?? 0,
      sales30d: Number(salesSummary[0]?.sales ?? 0),
      volume30d: money(salesSummary[0]?.volume),
      lastUpdated:
        cards
          .map(card => card.updatedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
    },
    gainers,
    losers,
    tracked,
    demand: demandRows
      .map(row =>
        attachPrice({
          ...row,
          cardId: row.cardId,
          searches: Number(row.searches ?? 0),
          views: Number(row.views ?? 0),
          score: Number(row.searches ?? 0) * 3 + Number(row.views ?? 0),
        })
      )
      .filter(row => row.currentPrice != null),
    mostWatched: watchedRows.map(row =>
      attachPrice({ ...row, watchers: Number(row.watchers ?? 0) })
    ),
    topSales: salesRows.map(row =>
      attachPrice({
        ...row,
        units: Number(row.units ?? 0),
        volume: money(row.volume),
      })
    ),
    recentSales: recentSales.map(row => ({
      ...row,
      totalUsd: money(row.totalUsd),
      soldAt: iso(row.soldAt),
    })),
    marketIndex: marketIndexFrom(grouped),
    methodology: {
      price: "Scrydex raw NM market price with TCGPlayer fallback",
      demand: "TCG Arena searches and card views",
      sales: "Paid TCG Arena marketplace orders",
    },
  };
}

export async function getCardMarketSummary(cardId: string, days = 90) {
  const db = await getDb();
  if (!db)
    return {
      cardId,
      current: null,
      history: [],
      changes: { day: null, week: null, month: null },
      demand: { searches: 0, views: 0, watchers: 0, sold: 0 },
    };
  const cutoff = new Date(Date.now() - Math.min(365, days) * DAY_MS);
  const [allHistory, demandRows, watcherRows, soldRows] = await Promise.all([
    db
      .select()
      .from(marketPriceSnapshots)
      .where(
        and(
          eq(marketPriceSnapshots.cardId, cardId),
          gte(marketPriceSnapshots.recordedAt, cutoff)
        )
      )
      .orderBy(marketPriceSnapshots.recordedAt),
    db
      .select({
        eventType: marketEvents.eventType,
        count: sql<number>`count(*)`,
      })
      .from(marketEvents)
      .where(
        and(
          eq(marketEvents.cardId, cardId),
          gte(marketEvents.createdAt, new Date(Date.now() - 30 * DAY_MS))
        )
      )
      .groupBy(marketEvents.eventType),
    db
      .select({ count: sql<number>`count(*)` })
      .from(marketWatchlist)
      .where(
        and(
          eq(marketWatchlist.cardId, cardId),
          eq(marketWatchlist.isActive, true)
        )
      ),
    db
      .select({ count: sql<number>`coalesce(sum(${orders.quantity}), 0)` })
      .from(orders)
      .innerJoin(listings, eq(orders.listingId, listings.id))
      .where(
        and(
          eq(listings.cardId, cardId),
          eq(orders.paymentStatus, "paid"),
          gte(orders.createdAt, new Date(Date.now() - 30 * DAY_MS))
        )
      ),
  ]);
  const history = selectComparableMarketSeries(allHistory);
  const latest = history.at(-1) ?? null;
  const eventCounts = new Map(
    demandRows.map(row => [row.eventType, Number(row.count)])
  );
  const current = latest ? money(latest.marketPriceUsd) : 0;
  const changeFor = (period: number) => {
    const baseline = baselineFor(history, period);
    return baseline
      ? changeBetween(current, money(baseline.marketPriceUsd))
      : null;
  };
  return {
    cardId,
    current: latest
      ? {
          price: current,
          low: latest.lowPriceUsd == null ? null : money(latest.lowPriceUsd),
          source: latest.source,
          variant: latest.variant,
          updatedAt: iso(latest.recordedAt),
        }
      : null,
    history: history.map(row => ({
      date: iso(row.recordedAt),
      price: money(row.marketPriceUsd),
      low: row.lowPriceUsd == null ? null : money(row.lowPriceUsd),
      source: row.source,
    })),
    changes: {
      day: changeFor(1),
      week: changeFor(7),
      month: changeFor(30),
    },
    demand: {
      searches: eventCounts.get("search") ?? 0,
      views: eventCounts.get("card_view") ?? 0,
      watchers: Number(watcherRows[0]?.count ?? 0),
      sold: Number(soldRows[0]?.count ?? 0),
    },
  };
}

export async function getUserMarketWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const watches = await db
    .select()
    .from(marketWatchlist)
    .where(
      and(
        eq(marketWatchlist.userId, userId),
        eq(marketWatchlist.isActive, true)
      )
    )
    .orderBy(desc(marketWatchlist.updatedAt));
  if (watches.length === 0) return [];
  const rows = await db
    .select()
    .from(marketPriceSnapshots)
    .where(
      and(
        inArray(
          marketPriceSnapshots.cardId,
          watches.map(row => row.cardId)
        ),
        gte(marketPriceSnapshots.recordedAt, new Date(Date.now() - 45 * DAY_MS))
      )
    )
    .orderBy(marketPriceSnapshots.recordedAt);
  const grouped = groupSnapshots(rows);
  return watches.map(watch => {
    const history = selectComparableMarketSeries(
      grouped.get(watch.cardId) ?? []
    );
    const latest = history.at(-1);
    const baseline = baselineFor(history, 7);
    const price = latest ? money(latest.marketPriceUsd) : null;
    return {
      ...watch,
      targetPriceUsd:
        watch.targetPriceUsd == null ? null : money(watch.targetPriceUsd),
      currentPrice: price,
      change7d:
        latest && baseline
          ? changeBetween(price ?? 0, money(baseline.marketPriceUsd))
          : null,
      source: latest?.source ?? null,
      updatedAt: iso(latest?.recordedAt ?? watch.updatedAt),
    };
  });
}

export async function getCollectorPortfolio(userId: number) {
  const db = await getDb();
  if (!db)
    return {
      totalCards: 0,
      uniqueCards: 0,
      currentValue: 0,
      pricedCards: 0,
      change7d: null,
      positions: [],
    };
  const collection = await db
    .select()
    .from(binderCards)
    .where(eq(binderCards.userId, userId));
  if (collection.length === 0)
    return {
      totalCards: 0,
      uniqueCards: 0,
      currentValue: 0,
      pricedCards: 0,
      change7d: null,
      positions: [],
    };
  const rows = await db
    .select()
    .from(marketPriceSnapshots)
    .where(
      and(
        inArray(
          marketPriceSnapshots.cardId,
          collection.map(row => row.cardId)
        ),
        gte(marketPriceSnapshots.recordedAt, new Date(Date.now() - 45 * DAY_MS))
      )
    )
    .orderBy(marketPriceSnapshots.recordedAt);
  const grouped = groupSnapshots(rows);
  let currentValue = 0;
  let previousValue = 0;
  let comparableValue = 0;
  let pricedCards = 0;
  const positions = collection.map(card => {
    const history = selectComparableMarketSeries(
      grouped.get(card.cardId) ?? []
    );
    const latest = history.at(-1);
    const baseline = baselineFor(history, 7);
    const stored = card.priceUsd == null ? null : money(card.priceUsd);
    const currentPrice = latest ? money(latest.marketPriceUsd) : stored;
    const value = (currentPrice ?? 0) * card.quantity;
    currentValue += value;
    if (currentPrice != null) pricedCards += 1;
    if (baseline) {
      const previous = money(baseline.marketPriceUsd) * card.quantity;
      previousValue += previous;
      comparableValue += value;
    }
    return {
      cardId: card.cardId,
      cardName: card.cardName,
      setName: card.setName,
      imageUrl: card.imageUrl,
      quantity: card.quantity,
      currentPrice,
      value,
      source: latest?.source ?? (stored != null ? "Saved binder price" : null),
      change7d:
        baseline && currentPrice != null
          ? changeBetween(currentPrice, money(baseline.marketPriceUsd))
          : null,
    };
  });
  return {
    totalCards: collection.reduce((sum, row) => sum + row.quantity, 0),
    uniqueCards: collection.length,
    currentValue,
    pricedCards,
    change7d:
      previousValue > 0 ? changeBetween(comparableValue, previousValue) : null,
    positions: positions.sort((a, b) => b.value - a.value).slice(0, 12),
  };
}
