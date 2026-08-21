import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  dropAlerts,
  dropCompanionTokens,
  dropEvents,
  dropMonitors,
  dropProductStates,
  dropReleaseWindows,
  dropWorkerLeases,
  type DropMonitor,
  type DropProductState,
  type InsertDropEvent,
  type InsertDropMonitor,
  type InsertDropReleaseWindow,
} from "../drizzle/schema";
import { DEFAULT_RELEASE_WINDOWS } from "../shared/drops";
import { getDb } from "./db";

function isDuplicate(error: unknown) {
  const value = error as { code?: string; cause?: { code?: string } };
  const message = error instanceof Error ? error.message : String(error);
  return (
    value.code === "ER_DUP_ENTRY" ||
    value.cause?.code === "ER_DUP_ENTRY" ||
    /duplicate entry/i.test(message)
  );
}

export async function listDropMonitors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dropMonitors)
    .where(eq(dropMonitors.userId, userId))
    .orderBy(desc(dropMonitors.createdAt));
}

export async function listActiveDropMonitors(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dropMonitors)
    .where(eq(dropMonitors.isActive, true))
    .orderBy(dropMonitors.lastCheckedAt)
    .limit(limit);
}

export async function getDropMonitor(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(dropMonitors)
    .where(
      userId === undefined
        ? eq(dropMonitors.id, id)
        : and(eq(dropMonitors.id, id), eq(dropMonitors.userId, userId))
    )
    .limit(1);
  return row ?? null;
}

export async function createDropMonitor(data: InsertDropMonitor) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const identity = data.productUrl
    ? eq(dropMonitors.productUrl, data.productUrl)
    : and(
        isNull(dropMonitors.productUrl),
        eq(dropMonitors.searchQuery, data.searchQuery)
      );
  const [existing] = await db
    .select()
    .from(dropMonitors)
    .where(
      and(
        eq(dropMonitors.userId, data.userId),
        eq(dropMonitors.retailer, data.retailer),
        identity
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(dropMonitors)
      .set({
        ...data,
        legacyAlertId: existing.legacyAlertId,
        isActive: true,
      })
      .where(eq(dropMonitors.id, existing.id));
    return getDropMonitor(existing.id, data.userId);
  }

  const [result] = await db.insert(dropMonitors).values(data);
  return getDropMonitor(result.insertId, data.userId);
}

export async function updateDropMonitor(
  id: number,
  userId: number,
  data: Partial<InsertDropMonitor>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(dropMonitors)
    .set(data)
    .where(and(eq(dropMonitors.id, id), eq(dropMonitors.userId, userId)));
  return getDropMonitor(id, userId);
}

export async function deleteDropMonitor(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const monitor = await getDropMonitor(id, userId);
  if (!monitor) return false;
  await db.transaction(async tx => {
    await tx
      .delete(dropMonitors)
      .where(and(eq(dropMonitors.id, id), eq(dropMonitors.userId, userId)));
    if (monitor.legacyAlertId) {
      await tx
        .delete(dropAlerts)
        .where(
          and(
            eq(dropAlerts.id, monitor.legacyAlertId),
            eq(dropAlerts.userId, userId)
          )
        );
    }
  });
  return true;
}

export async function acquireDropWorkerLease(
  holder: string,
  leaseMilliseconds = 60_000
) {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + leaseMilliseconds);

  await db
    .update(dropWorkerLeases)
    .set({ holder, lockedUntil })
    .where(
      and(
        eq(dropWorkerLeases.leaseKey, "provider-poller"),
        or(
          lte(dropWorkerLeases.lockedUntil, now),
          eq(dropWorkerLeases.holder, holder)
        )
      )
    );
  await db
    .insert(dropWorkerLeases)
    .values({ leaseKey: "provider-poller", holder, lockedUntil })
    .onDuplicateKeyUpdate({
      set: { updatedAt: sql`${dropWorkerLeases.updatedAt}` },
    });

  const [lease] = await db
    .select({ holder: dropWorkerLeases.holder })
    .from(dropWorkerLeases)
    .where(eq(dropWorkerLeases.leaseKey, "provider-poller"))
    .limit(1);
  return lease?.holder === holder;
}

export async function releaseDropWorkerLease(holder: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(dropWorkerLeases)
    .set({ lockedUntil: new Date() })
    .where(
      and(
        eq(dropWorkerLeases.leaseKey, "provider-poller"),
        eq(dropWorkerLeases.holder, holder)
      )
    );
}

export async function ensureDefaultDropWindows(userId: number) {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db
    .select({ id: dropReleaseWindows.id })
    .from(dropReleaseWindows)
    .where(eq(dropReleaseWindows.userId, userId))
    .limit(1);
  if (existing) return;
  await db.insert(dropReleaseWindows).values(
    DEFAULT_RELEASE_WINDOWS.map(window => ({
      ...window,
      userId,
      isActive: true,
    }))
  );
}

export async function listDropReleaseWindows(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId !== undefined) await ensureDefaultDropWindows(userId);
  return db
    .select()
    .from(dropReleaseWindows)
    .where(
      userId === undefined
        ? eq(dropReleaseWindows.isActive, true)
        : eq(dropReleaseWindows.userId, userId)
    )
    .orderBy(
      dropReleaseWindows.weekday,
      dropReleaseWindows.startMinute
    );
}

export async function createDropReleaseWindow(
  data: InsertDropReleaseWindow
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(dropReleaseWindows).values(data);
  const [row] = await db
    .select()
    .from(dropReleaseWindows)
    .where(eq(dropReleaseWindows.id, result.insertId))
    .limit(1);
  return row ?? null;
}

export async function updateDropReleaseWindow(
  id: number,
  userId: number,
  data: Partial<InsertDropReleaseWindow>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(dropReleaseWindows)
    .set(data)
    .where(
      and(
        eq(dropReleaseWindows.id, id),
        eq(dropReleaseWindows.userId, userId)
      )
    );
}

export async function deleteDropReleaseWindow(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(dropReleaseWindows)
    .where(
      and(
        eq(dropReleaseWindows.id, id),
        eq(dropReleaseWindows.userId, userId)
      )
    );
}

export async function getDropProductState(
  monitorId: number,
  retailerProductId: string
) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(dropProductStates)
    .where(
      and(
        eq(dropProductStates.monitorId, monitorId),
        eq(dropProductStates.retailerProductId, retailerProductId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function saveDropProductState(
  monitorId: number,
  product: Pick<
    DropProductState,
    | "retailerProductId"
    | "title"
    | "productUrl"
    | "stockState"
    | "priceCents"
    | "currency"
  >,
  triggeredAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const now = new Date();
  await db
    .insert(dropProductStates)
    .values({
      monitorId,
      ...product,
      lastSeenAt: now,
      lastTriggeredAt: triggeredAt ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        title: product.title,
        productUrl: product.productUrl,
        stockState: product.stockState,
        priceCents: product.priceCents,
        currency: product.currency,
        lastSeenAt: now,
        ...(triggeredAt ? { lastTriggeredAt: triggeredAt } : {}),
      },
    });
}

export async function recordDropEvent(data: InsertDropEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  try {
    const [result] = await db.insert(dropEvents).values(data);
    const [row] = await db
      .select()
      .from(dropEvents)
      .where(eq(dropEvents.id, result.insertId))
      .limit(1);
    return { inserted: true, event: row ?? null };
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const [row] = await db
      .select()
      .from(dropEvents)
      .where(eq(dropEvents.fingerprint, data.fingerprint))
      .limit(1);
    return { inserted: false, event: row ?? null };
  }
}

export async function markDropEventNotified(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(dropEvents)
    .set({ notifiedAt: new Date() })
    .where(eq(dropEvents.id, id));
}

export async function listRecentDropEvents(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dropEvents)
    .where(eq(dropEvents.userId, userId))
    .orderBy(desc(dropEvents.detectedAt))
    .limit(limit);
}

export async function listPendingDropEvents(
  limit = 50,
  olderThan = new Date(Date.now() - 30_000)
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dropEvents)
    .where(
      and(
        isNull(dropEvents.notifiedAt),
        lte(dropEvents.createdAt, olderThan)
      )
    )
    .orderBy(dropEvents.createdAt)
    .limit(limit);
}

export async function markDropMonitorChecked(
  monitor: DropMonitor,
  input: {
    stockState?: string;
    priceCents?: number | null;
    triggered?: boolean;
    error?: string | null;
  }
) {
  return updateDropMonitor(monitor.id, monitor.userId, {
    lastCheckedAt: new Date(),
    lastStockState: input.stockState ?? monitor.lastStockState,
    lastPriceCents:
      input.priceCents === undefined
        ? monitor.lastPriceCents
        : input.priceCents,
    lastTriggeredAt: input.triggered ? new Date() : monitor.lastTriggeredAt,
    lastError: input.error ?? null,
  });
}

export async function createDropCompanionToken(input: {
  userId: number;
  name: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(dropCompanionTokens).values(input);
  return result.insertId;
}

export async function listDropCompanionTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: dropCompanionTokens.id,
      name: dropCompanionTokens.name,
      lastUsedAt: dropCompanionTokens.lastUsedAt,
      expiresAt: dropCompanionTokens.expiresAt,
      revokedAt: dropCompanionTokens.revokedAt,
      createdAt: dropCompanionTokens.createdAt,
    })
    .from(dropCompanionTokens)
    .where(eq(dropCompanionTokens.userId, userId))
    .orderBy(desc(dropCompanionTokens.createdAt));
}

export async function revokeDropCompanionToken(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(dropCompanionTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(dropCompanionTokens.id, id),
        eq(dropCompanionTokens.userId, userId)
      )
    );
}

export async function authenticateDropCompanionToken(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const [token] = await db
    .select()
    .from(dropCompanionTokens)
    .where(eq(dropCompanionTokens.tokenHash, tokenHash))
    .limit(1);
  if (
    !token ||
    token.revokedAt ||
    (token.expiresAt && token.expiresAt.getTime() <= Date.now())
  ) {
    return null;
  }
  await db
    .update(dropCompanionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(dropCompanionTokens.id, token.id));
  return token;
}
