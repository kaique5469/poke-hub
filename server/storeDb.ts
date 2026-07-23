/** DB helpers for seller stores + Stripe payment status. */
import { and, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  cartItems,
  listings,
  marketplaceReports,
  notifications,
  orderEvents,
  orders,
  payouts,
  productListings,
  products,
  sellerReviews,
  sellerStores,
  users,
  webhookEvents,
  type InsertSellerStore,
  type SellerStore,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  createRefund,
  createTransfer,
  getCheckoutSessionStatus,
  getSessionPaymentDetails,
  stripeEnabled,
} from "./lib/stripe";
import { MARKETPLACE_TERMS_VERSION } from "@shared/marketplace";
import { MARKETPLACE_COUNTRY } from "@shared/marketplace";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function getStoreByUserId(
  userId: number
): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(sellerStores)
    .where(eq(sellerStores.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Server-side gate used by every inventory mutation. */
export async function requireSellerReady(userId: number): Promise<SellerStore> {
  const store = await getStoreByUserId(userId);
  if (!store) throw new Error("Open your store before publishing inventory");
  if (store.status !== "active") throw new Error("Your store is paused");
  if (
    !store.sellerTermsAcceptedAt ||
    store.sellerTermsVersion !== MARKETPLACE_TERMS_VERSION
  ) {
    throw new Error(
      "Accept the current seller terms before publishing inventory"
    );
  }
  if (
    !stripeEnabled() ||
    !store.stripeAccountId ||
    !store.stripePayoutsEnabled ||
    store.country !== MARKETPLACE_COUNTRY
  ) {
    throw new Error(
      "Conclua a verificação brasileira do Stripe antes de publicar anúncios"
    );
  }
  return store;
}

export async function getStoreBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      store: sellerStores,
      ownerName: users.name,
      ownerUsername: users.username,
      ownerAvatarUrl: users.avatarUrl,
      sellerRating: users.sellerRating,
      totalSales: users.totalSales,
      isVerifiedSeller: users.isVerifiedSeller,
      hasPhysicalStore: users.hasPhysicalStore,
      memberSince: users.createdAt,
    })
    .from(sellerStores)
    .leftJoin(users, eq(users.id, sellerStores.userId))
    .where(
      and(
        eq(sellerStores.slug, slug),
        eq(sellerStores.status, "active"),
        eq(sellerStores.stripePayoutsEnabled, true),
        eq(sellerStores.country, MARKETPLACE_COUNTRY),
        isNotNull(sellerStores.stripeAccountId),
        isNotNull(sellerStores.sellerTermsAcceptedAt),
        eq(sellerStores.sellerTermsVersion, MARKETPLACE_TERMS_VERSION)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createStore(
  userId: number,
  data: Omit<InsertSellerStore, "userId" | "slug">
): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getStoreByUserId(userId);
  if (existing) throw new Error("You already have a store");
  if (
    !data.sellerTermsAcceptedAt ||
    data.sellerTermsVersion !== MARKETPLACE_TERMS_VERSION
  ) {
    throw new Error("Accept the current seller terms before opening a store");
  }

  let slug = slugify(data.storeName);
  if (!slug) throw new Error("Invalid store name");
  const clash = await db
    .select({ id: sellerStores.id })
    .from(sellerStores)
    .where(eq(sellerStores.slug, slug))
    .limit(1);
  if (clash[0]) slug = `${slug}-${userId}`;

  await db.insert(sellerStores).values({
    ...data,
    userId,
    slug,
  });
  return getStoreByUserId(userId);
}

export async function updateStore(
  userId: number,
  data: Partial<Omit<InsertSellerStore, "userId" | "slug">>
): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(sellerStores)
    .set(data)
    .where(eq(sellerStores.userId, userId));
  return getStoreByUserId(userId);
}

/** Active card + product listings for a seller (public store page). */
export async function getStoreListings(sellerId: number) {
  const db = await getDb();
  if (!db) return { cards: [], products: [] };
  const [cards, prods] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.sellerId, sellerId),
          eq(listings.status, "active"),
          eq(listings.currency, "BRL")
        )
      )
      .orderBy(desc(listings.createdAt))
      .limit(60),
    db
      .select({
        listing: productListings,
        productName: products.name,
        productImageUrl: products.imageUrl,
        productSlug: products.slug,
      })
      .from(productListings)
      .leftJoin(products, eq(productListings.productId, products.id))
      .where(
        and(
          eq(productListings.sellerId, sellerId),
          eq(productListings.status, "active"),
          eq(productListings.currency, "BRL")
        )
      )
      .orderBy(desc(productListings.createdAt))
      .limit(60),
  ]);
  return { cards, products: prods };
}

/** Public performance summary built only from completed marketplace records. */
export async function getStoreTrustMetrics(sellerId: number) {
  const db = await getDb();
  if (!db) {
    return {
      successfulOrders: 0,
      cancelledOrders: 0,
      openDisputes: 0,
      verifiedReviews: 0,
    };
  }
  const [orderAgg, reviewAgg] = await Promise.all([
    db
      .select({
        successfulOrders: sql<number>`sum(case when ${orders.status} = 'delivered' then 1 else 0 end)`,
        cancelledOrders: sql<number>`sum(case when ${orders.status} = 'cancelled' then 1 else 0 end)`,
        openDisputes: sql<number>`sum(case when ${orders.status} = 'disputed' then 1 else 0 end)`,
      })
      .from(orders)
      .where(eq(orders.sellerId, sellerId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(sellerReviews)
      .where(eq(sellerReviews.sellerId, sellerId)),
  ]);
  return {
    successfulOrders: Number(orderAgg[0]?.successfulOrders ?? 0),
    cancelledOrders: Number(orderAgg[0]?.cancelledOrders ?? 0),
    openDisputes: Number(orderAgg[0]?.openDisputes ?? 0),
    verifiedReviews: Number(reviewAgg[0]?.count ?? 0),
  };
}

export type MarketplaceReportReason =
  | "suspected_counterfeit"
  | "misleading_listing"
  | "prohibited_item"
  | "harassment"
  | "other";

export type MarketplaceReportTarget =
  "store" | "card_listing" | "product_listing" | "order";

export async function submitMarketplaceReport(
  reporterId: number,
  input: {
    targetType: MarketplaceReportTarget;
    targetId: number;
    reason: MarketplaceReportReason;
    details: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  let sellerId: number | null = null;
  if (input.targetType === "store") {
    const [store] = await db
      .select({ userId: sellerStores.userId })
      .from(sellerStores)
      .where(eq(sellerStores.id, input.targetId))
      .limit(1);
    if (!store) throw new Error("Store not found");
    sellerId = store.userId;
  } else if (input.targetType === "card_listing") {
    const [listing] = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(eq(listings.id, input.targetId))
      .limit(1);
    if (!listing) throw new Error("Listing not found");
    sellerId = listing.sellerId;
  } else if (input.targetType === "product_listing") {
    const [listing] = await db
      .select({ sellerId: productListings.sellerId })
      .from(productListings)
      .where(eq(productListings.id, input.targetId))
      .limit(1);
    if (!listing) throw new Error("Listing not found");
    sellerId = listing.sellerId;
  } else {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, input.targetId))
      .limit(1);
    if (!order || ![order.buyerId, order.sellerId].includes(reporterId)) {
      throw new Error("Order not found");
    }
    sellerId = order.sellerId;
  }
  if (sellerId === reporterId) {
    throw new Error("You cannot report your own store");
  }

  const [existing] = await db
    .select({ id: marketplaceReports.id })
    .from(marketplaceReports)
    .where(
      and(
        eq(marketplaceReports.reporterId, reporterId),
        eq(marketplaceReports.targetType, input.targetType),
        eq(marketplaceReports.targetId, input.targetId),
        inArray(marketplaceReports.status, ["open", "reviewing"])
      )
    )
    .limit(1);
  if (existing) return { id: existing.id, duplicate: true };

  const [result] = await db.insert(marketplaceReports).values({
    reporterId,
    sellerId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details.trim(),
  });
  return { id: result.insertId, duplicate: false };
}

export async function updateMarketplaceReport(
  reportId: number,
  status: "reviewing" | "resolved" | "dismissed",
  adminNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [report] = await db
    .select()
    .from(marketplaceReports)
    .where(eq(marketplaceReports.id, reportId))
    .limit(1);
  if (!report) throw new Error("Report not found");
  await db
    .update(marketplaceReports)
    .set({
      status,
      adminNote: adminNote?.trim() || report.adminNote,
      resolvedAt: status === "reviewing" ? null : new Date(),
    })
    .where(eq(marketplaceReports.id, reportId));
  return { success: true };
}

export async function pauseSellerForSafety(sellerId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [store] = await db
    .select()
    .from(sellerStores)
    .where(eq(sellerStores.userId, sellerId))
    .limit(1);
  if (!store) throw new Error("Seller store not found");
  await db
    .update(sellerStores)
    .set({ status: "paused" })
    .where(eq(sellerStores.userId, sellerId));
  await db.insert(notifications).values({
    userId: sellerId,
    type: "order_update",
    title: "Store paused for safety review",
    message: reason.trim().slice(0, 1000),
    entityType: "store",
    entityId: String(store.id),
  });
  return { success: true };
}

/** Attach a Stripe session id to freshly created orders. */
export async function attachStripeSession(
  orderIds: number[],
  sessionId: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db || orderIds.length === 0) return;
  await db
    .update(orders)
    .set({
      stripeSessionId: sessionId,
      stripeSessionExpiresAt: expiresAt,
      paymentStatus: "processing",
    })
    .where(inArray(orders.id, orderIds));
}

async function cancelReservedRows(
  orderIds: number[],
  reason: string
): Promise<number> {
  const db = await getDb();
  if (!db || orderIds.length === 0) return 0;
  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(orders)
      .where(inArray(orders.id, orderIds))
      .for("update");
    let cancelled = 0;
    for (const order of rows) {
      if (
        order.status !== "pending" ||
        !["unpaid", "processing"].includes(order.paymentStatus)
      ) {
        continue;
      }
      if (order.listingId) {
        await tx
          .update(listings)
          .set({
            quantity: sql`quantity + ${order.quantity}` as never,
            status: "active",
          })
          .where(eq(listings.id, order.listingId));
      } else if (order.productListingId) {
        await tx
          .update(productListings)
          .set({
            quantity: sql`quantity + ${order.quantity}` as never,
            status: "active",
          })
          .where(eq(productListings.id, order.productListingId));
      }
      await tx
        .update(orders)
        .set({
          status: "cancelled",
          paymentStatus: "unpaid",
          payoutStatus: "refunded",
          cancellationReason: reason.slice(0, 255),
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        orderId: order.id,
        actorType: "system",
        eventType: "reservation_cancelled",
        fromStatus: order.status,
        toStatus: "cancelled",
        note: reason.slice(0, 1000),
      });
      cancelled++;
    }
    return cancelled;
  });
}

/** Restore inventory when Stripe session creation fails before redirect. */
export function cancelReservedOrders(orderIds: number[], reason: string) {
  return cancelReservedRows(orderIds, reason);
}

/** Restore inventory when Stripe reports that a Checkout Session expired. */
export async function cancelCheckoutSessionOrders(
  sessionId: string,
  reason = "Stripe checkout expired"
) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.stripeSessionId, sessionId));
  return cancelReservedRows(
    rows.map(row => row.id),
    reason
  );
}

export interface ReservationReconciliation {
  checked: number;
  paid: number;
  cancelled: number;
  pending: number;
  failedSessionIds: string[];
}

/**
 * Safety net for a missed Stripe webhook. Never restore inventory from the
 * local clock alone: first ask Stripe whether the session was paid, expired,
 * or is still open. This prevents a delayed webhook from turning a successful
 * payment into an oversold, cancelled order.
 */
export async function reconcileExpiredCheckoutReservations(): Promise<ReservationReconciliation> {
  const db = await getDb();
  const empty = {
    checked: 0,
    paid: 0,
    cancelled: 0,
    pending: 0,
    failedSessionIds: [] as string[],
  };
  if (!db) return empty;
  const rows = await db
    .select({ sessionId: orders.stripeSessionId })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentStatus, "processing"),
        lte(orders.stripeSessionExpiresAt, new Date())
      )
    );
  const sessions = Array.from(
    new Set(rows.map(row => row.sessionId).filter((id): id is string => !!id))
  );
  const result: ReservationReconciliation = {
    ...empty,
    checked: sessions.length,
  };
  for (const sessionId of sessions) {
    try {
      const session = await getCheckoutSessionStatus(sessionId);
      if (session.paymentStatus === "paid") {
        result.paid += await markOrdersPaid(sessionId);
        continue;
      }
      if (session.status === "expired") {
        result.cancelled += await cancelCheckoutSessionOrders(
          sessionId,
          "Secure checkout expired"
        );
        continue;
      }
      result.pending++;
    } catch (error) {
      result.failedSessionIds.push(sessionId);
      console.error(
        `[stripe] reservation reconciliation failed for ${sessionId}:`,
        error
      );
    }
  }
  return result;
}

// ─── Webhook idempotency ─────────────────────────────────────────────────────

/** Has this Stripe event already been processed? */
export async function wasEventProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !eventId) return false;
  const rows = await db
    .select({ eventId: webhookEvents.eventId })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId))
    .limit(1);
  return rows.length > 0;
}

/** Record a processed Stripe event (idempotency marker). */
export async function recordEvent(
  eventId: string,
  type: string
): Promise<void> {
  const db = await getDb();
  if (!db || !eventId) return;
  await db
    .insert(webhookEvents)
    .values({ eventId, type })
    .catch(() => {}); // dup PK = already recorded
}

/**
 * Mark all orders of a Stripe session as paid + notify buyer/sellers.
 * ESCROW: funds stay HELD on the platform (payoutStatus=held) — the seller is
 * paid only at release time (buyer confirmation or auto-release after delivery).
 */
export async function markOrdersPaid(sessionId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.stripeSessionId, sessionId),
        eq(orders.status, "pending"),
        eq(orders.paymentStatus, "processing")
      )
    );
  if (rows.length === 0) return 0;

  const payment = await getSessionPaymentDetails(sessionId);
  if (!payment.chargeId) throw new Error("Stripe charge is missing");
  if (!payment.shippingAddress || !payment.shippingName) {
    throw new Error("Stripe shipping address is missing");
  }

  const [updated] = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "paid",
      payoutStatus: "held",
      buyerProtection: true,
      stripeChargeId: payment.chargeId,
      shippingName: payment.shippingName,
      shippingPhone: payment.shippingPhone,
      shippingAddress: payment.shippingAddress,
    })
    .where(
      and(
        eq(orders.stripeSessionId, sessionId),
        eq(orders.status, "pending"),
        eq(orders.paymentStatus, "processing")
      )
    );
  if (Number((updated as { affectedRows?: number }).affectedRows ?? 0) === 0) {
    return 0;
  }

  for (const o of rows) {
    await db.insert(orderEvents).values({
      orderId: o.id,
      actorType: "stripe",
      eventType: "payment_confirmed",
      fromStatus: o.status,
      toStatus: "paid",
      metadata: { sessionId, chargeId: payment.chargeId },
    });
    await db.insert(notifications).values([
      {
        userId: o.sellerId,
        type: "order_update",
        title: "Paid order ready to ship",
        message: `Payment confirmed for order #${o.id}. Ship it to the address shown in your sales dashboard.`,
        entityType: "order",
        entityId: String(o.id),
      },
      {
        userId: o.buyerId,
        type: "order_update",
        title: "Payment confirmed",
        message: `Your payment for order #${o.id} was confirmed. Funds are held until delivery is confirmed.`,
        entityType: "order",
        entityId: String(o.id),
      },
    ]);
  }
  return rows.length;
}

/**
 * Sellers in the buyer's cart whose stores can't receive card payouts yet.
 * Used to gate on-platform card checkout.
 */
export async function getUnpayableCartSellers(
  buyerId: number
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.userId, buyerId));
  const sellerIds = new Set<number>();
  for (const it of items) {
    if (it.listingId) {
      const [l] = await db
        .select({ sellerId: listings.sellerId })
        .from(listings)
        .where(eq(listings.id, it.listingId))
        .limit(1);
      if (l) sellerIds.add(l.sellerId);
    } else if (it.productListingId) {
      const [pl] = await db
        .select({ sellerId: productListings.sellerId })
        .from(productListings)
        .where(eq(productListings.id, it.productListingId))
        .limit(1);
      if (pl) sellerIds.add(pl.sellerId);
    }
  }
  if (sellerIds.size === 0) return [];
  const ids = Array.from(sellerIds);
  const stores = await db
    .select()
    .from(sellerStores)
    .where(inArray(sellerStores.userId, ids));
  const bad: string[] = [];
  for (const id of ids) {
    const store = stores.find(st => st.userId === id);
    if (
      !store ||
      store.status !== "active" ||
      !store.stripeAccountId ||
      !store.stripePayoutsEnabled ||
      store.country !== MARKETPLACE_COUNTRY ||
      !store.sellerTermsAcceptedAt ||
      store.sellerTermsVersion !== MARKETPLACE_TERMS_VERSION
    ) {
      const [u] = await db
        .select({ name: users.name, username: users.username })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      bad.push(store?.storeName ?? u?.username ?? u?.name ?? `seller #${id}`);
    }
  }
  return bad;
}

const PLATFORM_FEE = 0.05;

/** 95% of the order total, computed in integer cents (no float drift). */
export function sellerShareCents(totalBrl: string | number): number {
  const totalCents = Math.round(parseFloat(String(totalBrl)) * 100);
  return totalCents - Math.round(totalCents * PLATFORM_FEE);
}

/**
 * ESCROW RELEASE: transfer the seller's share (95%) of ONE order to their
 * connected Stripe account. Idempotent — guarded by payoutStatus, a ledger
 * row in `payouts` and a Stripe Idempotency-Key per order.
 * Only valid when the order is delivered/completed and funds are held.
 */
export async function releaseOrder(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // The row lock serializes buyer disputes, admin refunds and scheduled
  // releases. Holding it across the idempotent Stripe transfer is deliberate:
  // money must never leave while a dispute transition wins the race.
  let transferError: unknown;
  const released = await db.transaction(async tx => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");
    if (!order) throw new Error("Order not found");
    if (order.payoutStatus !== "held") return false;
    const pastWindow =
      order.autoReleaseAt !== null && order.autoReleaseAt <= new Date();
    const releasable =
      ["delivered", "completed"].includes(order.status) ||
      (order.status === "shipped" && pastWindow);
    if (!releasable) throw new Error("Order is not delivered yet");

    const [existing] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.orderId, orderId))
      .limit(1);
    if (existing && existing.status !== "failed") return false;
    if (!stripeEnabled()) {
      throw new Error("Stripe is unavailable; payout remains safely held");
    }
    if (!order.stripeChargeId) {
      throw new Error("Order has no Stripe charge attached");
    }

    const [store] = await tx
      .select()
      .from(sellerStores)
      .where(eq(sellerStores.userId, order.sellerId))
      .limit(1);
    if (!store?.stripeAccountId || !store.stripePayoutsEnabled) {
      throw new Error(
        `Seller ${order.sellerId} has no payout account — funds stay on platform`
      );
    }

    const amountCents = sellerShareCents(order.totalUsd);
    if (amountCents <= 0) return false;
    if (existing) {
      await tx
        .update(payouts)
        .set({ status: "pending" })
        .where(eq(payouts.orderId, orderId));
    } else {
      await tx.insert(payouts).values({
        orderId,
        sellerId: order.sellerId,
        amountCents,
        status: "pending",
      });
    }

    let transferId: string;
    try {
      transferId = await createTransfer({
        amountCents,
        destination: store.stripeAccountId,
        sourceCharge: order.stripeChargeId,
        description: `RarityGrid payout — order #${orderId}`,
        idempotencyKey: `payout_order_${orderId}`,
      });
    } catch (error) {
      await tx
        .update(payouts)
        .set({ status: "failed" })
        .where(eq(payouts.orderId, orderId));
      transferError = error;
      return false;
    }

    await tx
      .update(payouts)
      .set({ stripeTransferId: transferId, status: "sent" })
      .where(eq(payouts.orderId, orderId));
    await tx
      .update(orders)
      .set({ payoutStatus: "released" })
      .where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({
      orderId,
      actorType: "system",
      eventType: "payout_released",
      fromStatus: order.status,
      toStatus: order.status,
      metadata: { transferId, amountCents },
    });
    await tx.insert(notifications).values({
      userId: order.sellerId,
      type: "order_update",
      title: "Payout sent",
      message: `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} do pedido #${orderId} foram enviados à sua conta Stripe (95% da venda — 5% de taxa da plataforma).`,
      entityType: "order",
      entityId: String(orderId),
    });
    console.log(
      `[stripe] released ${amountCents}c to seller ${order.sellerId} for order #${orderId} (${transferId})`
    );
    return true;
  });
  if (transferError) throw transferError;
  return released;
}

/**
 * Refund the buyer in full (cancellation/dispute BEFORE release).
 * Only acts while funds are still held.
 */
export async function refundOrderMoney(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || order.payoutStatus !== "held") return false;

  if (order.paymentStatus === "paid") {
    if (!stripeEnabled()) {
      throw new Error("Stripe is unavailable; refund was not marked complete");
    }
    if (!order.stripeChargeId) {
      throw new Error(
        "Paid order has no Stripe charge; refund requires review"
      );
    }
    await createRefund(
      order.stripeChargeId,
      Math.round(parseFloat(String(order.totalUsd)) * 100),
      `refund_order_${orderId}`
    );
  }
  await db
    .update(orders)
    .set({ payoutStatus: "refunded", paymentStatus: "refunded" })
    .where(eq(orders.id, orderId));
  await db.insert(orderEvents).values({
    orderId,
    actorType: "system",
    eventType: "refund_issued",
    fromStatus: order.status,
    toStatus: order.status,
    metadata: {
      amountCents: Math.round(parseFloat(String(order.totalUsd)) * 100),
    },
  });

  await db.insert(notifications).values({
    userId: order.buyerId,
    type: "order_update",
    title: "Refund issued",
    message: `Order #${orderId} was refunded in full to your original payment method (5-10 business days).`,
    entityType: "order",
    entityId: String(orderId),
  });
  console.log(
    `[stripe] refunded order #${orderId} (charge ${order.stripeChargeId ?? "n/a"})`
  );
  return true;
}

/** Fetch a single order by id. */
export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}

/** Orders whose escrow is due for automatic release (delivered + window passed). */
export async function getOrdersDueForRelease(): Promise<{ id: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.payoutStatus, "held"),
        inArray(orders.status, ["delivered", "shipped"]),
        lte(orders.autoReleaseAt, new Date())
      )
    );
}

// ─── Admin: escrow reconciliation ────────────────────────────────────────────

/** Snapshot of the escrow state for the admin panel. */
export async function getEscrowOverview() {
  const db = await getDb();
  if (!db)
    return {
      held: [],
      disputed: [],
      needsShipment: [],
      reports: [],
      connectNeedsAction: [],
      ledger: [],
      failedPayouts: [],
      events: [],
      totals: { heldCents: 0, releasedCents: 0 },
    };

  const paidOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  const held = paidOrders.filter(
    o => o.payoutStatus === "held" && o.status !== "disputed"
  );
  const disputed = paidOrders.filter(
    o => o.status === "disputed" && o.payoutStatus === "held"
  );
  const ledger = await db
    .select()
    .from(payouts)
    .orderBy(desc(payouts.createdAt))
    .limit(100);
  const [shipmentRows, reports, connectNeedsAction, events] = await Promise.all(
    [
      db
        .select({
          order: orders,
          storeName: sellerStores.storeName,
          handlingDays: sellerStores.handlingDays,
        })
        .from(orders)
        .leftJoin(sellerStores, eq(sellerStores.userId, orders.sellerId))
        .where(and(eq(orders.status, "paid"), eq(orders.paymentStatus, "paid")))
        .orderBy(orders.createdAt)
        .limit(200),
      db
        .select({
          report: marketplaceReports,
          storeName: sellerStores.storeName,
        })
        .from(marketplaceReports)
        .leftJoin(
          sellerStores,
          eq(sellerStores.userId, marketplaceReports.sellerId)
        )
        .where(inArray(marketplaceReports.status, ["open", "reviewing"]))
        .orderBy(desc(marketplaceReports.createdAt))
        .limit(100),
      db
        .select({
          sellerId: sellerStores.userId,
          storeName: sellerStores.storeName,
          stripeAccountId: sellerStores.stripeAccountId,
          updatedAt: sellerStores.updatedAt,
        })
        .from(sellerStores)
        .where(
          and(
            eq(sellerStores.status, "active"),
            isNotNull(sellerStores.stripeAccountId),
            eq(sellerStores.stripePayoutsEnabled, false)
          )
        )
        .orderBy(desc(sellerStores.updatedAt))
        .limit(100),
      db
        .select()
        .from(orderEvents)
        .orderBy(desc(orderEvents.createdAt))
        .limit(100),
    ]
  );

  const now = Date.now();
  const needsShipment = shipmentRows.filter(row => {
    const handlingDays = Math.max(1, row.handlingDays ?? 2);
    return (
      new Date(row.order.createdAt).getTime() +
        handlingDays * 24 * 60 * 60 * 1000 <=
      now
    );
  });
  const failedPayouts = ledger.filter(p => p.status === "failed");

  const heldCents = held.reduce((s, o) => s + sellerShareCents(o.totalUsd), 0);
  const releasedCents = ledger
    .filter(p => p.status === "sent")
    .reduce((s, p) => s + p.amountCents, 0);

  return {
    held,
    disputed,
    needsShipment,
    reports,
    connectNeedsAction,
    ledger,
    failedPayouts,
    events,
    totals: { heldCents, releasedCents },
  };
}

/**
 * Admin resolves a dispute while funds are held:
 *  - refund_buyer  → full Stripe refund, order cancelled
 *  - release_seller → escrow released to the seller
 */
export async function adminResolveDispute(
  orderId: number,
  resolution: "refund_buyer" | "release_seller"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new Error("Order not found");
  if (order.status !== "disputed") throw new Error("Order is not disputed");
  if (order.payoutStatus !== "held")
    throw new Error("Funds are no longer held for this order");

  if (resolution === "refund_buyer") {
    await refundOrderMoney(orderId);
    await db
      .update(orders)
      .set({
        status: "cancelled",
        disputeResolution: resolution,
        disputeResolvedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await db.insert(orderEvents).values({
      orderId,
      actorType: "admin",
      eventType: "dispute_resolved",
      fromStatus: "disputed",
      toStatus: "cancelled",
      note: resolution,
    });
    await db.insert(notifications).values({
      userId: order.sellerId,
      type: "order_update",
      title: "Dispute resolved",
      message: `Order #${orderId}: the dispute was resolved in favor of the buyer — the payment was refunded.`,
      entityType: "order",
      entityId: String(orderId),
    });
  } else {
    // Reinstate delivered so releaseOrder's state check passes, then release.
    await db
      .update(orders)
      .set({
        status: "delivered",
        disputeResolution: resolution,
        disputeResolvedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await releaseOrder(orderId);
    await db.insert(orderEvents).values({
      orderId,
      actorType: "admin",
      eventType: "dispute_resolved",
      fromStatus: "disputed",
      toStatus: "delivered",
      note: resolution,
    });
    await db.insert(notifications).values({
      userId: order.buyerId,
      type: "order_update",
      title: "Dispute resolved",
      message: `Order #${orderId}: the dispute was resolved in favor of the seller — the payment was released.`,
      entityType: "order",
      entityId: String(orderId),
    });
  }
}
