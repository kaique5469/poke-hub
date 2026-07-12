/** DB helpers for seller stores + Stripe payment status. */
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import {
  cartItems,
  listings,
  notifications,
  orders,
  payouts,
  productListings,
  products,
  sellerStores,
  users,
  webhookEvents,
  type InsertSellerStore,
  type SellerStore,
} from "../drizzle/schema";
import { getDb } from "./db";
import { createRefund, createTransfer, getSessionCharge, stripeEnabled } from "./lib/stripe";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function getStoreByUserId(userId: number): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sellerStores).where(eq(sellerStores.userId, userId)).limit(1);
  return rows[0] ?? null;
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
    .where(eq(sellerStores.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function createStore(
  userId: number,
  data: Omit<InsertSellerStore, "userId" | "slug">,
): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getStoreByUserId(userId);
  if (existing) throw new Error("You already have a store");

  let slug = slugify(data.storeName);
  if (!slug) throw new Error("Invalid store name");
  const clash = await db.select({ id: sellerStores.id }).from(sellerStores)
    .where(eq(sellerStores.slug, slug)).limit(1);
  if (clash[0]) slug = `${slug}-${userId}`;

  await db.insert(sellerStores).values({ ...data, userId, slug });
  return getStoreByUserId(userId);
}

export async function updateStore(
  userId: number,
  data: Partial<Omit<InsertSellerStore, "userId" | "slug">>,
): Promise<SellerStore | null> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(sellerStores).set(data).where(eq(sellerStores.userId, userId));
  return getStoreByUserId(userId);
}

/** Active card + product listings for a seller (public store page). */
export async function getStoreListings(sellerId: number) {
  const db = await getDb();
  if (!db) return { cards: [], products: [] };
  const [cards, prods] = await Promise.all([
    db.select().from(listings)
      .where(and(eq(listings.sellerId, sellerId), eq(listings.status, "active")))
      .orderBy(desc(listings.createdAt)).limit(60),
    db.select({
        listing: productListings,
        productName: products.name,
        productImageUrl: products.imageUrl,
        productSlug: products.slug,
      })
      .from(productListings)
      .leftJoin(products, eq(productListings.productId, products.id))
      .where(and(eq(productListings.sellerId, sellerId), eq(productListings.status, "active")))
      .orderBy(desc(productListings.createdAt)).limit(60),
  ]);
  return { cards, products: prods };
}

/** Attach a Stripe session id to freshly created orders. */
export async function attachStripeSession(orderIds: number[], sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db || orderIds.length === 0) return;
  await db.update(orders)
    .set({ stripeSessionId: sessionId, paymentStatus: "processing" })
    .where(inArray(orders.id, orderIds));
}

// ─── Webhook idempotency ─────────────────────────────────────────────────────

/** Has this Stripe event already been processed? */
export async function wasEventProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !eventId) return false;
  const rows = await db.select({ eventId: webhookEvents.eventId }).from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId)).limit(1);
  return rows.length > 0;
}

/** Record a processed Stripe event (idempotency marker). */
export async function recordEvent(eventId: string, type: string): Promise<void> {
  const db = await getDb();
  if (!db || !eventId) return;
  await db.insert(webhookEvents).values({ eventId, type }).catch(() => {}); // dup PK = already recorded
}

/**
 * Mark all orders of a Stripe session as paid + notify buyer/sellers.
 * ESCROW: funds stay HELD on the platform (payoutStatus=held) — the seller is
 * paid only at release time (buyer confirmation or auto-release after delivery).
 */
export async function markOrdersPaid(sessionId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
  if (rows.length === 0) return 0;

  // Charge id is needed later for the delayed transfer (source_transaction)
  const charge = await getSessionCharge(sessionId).catch((e) => {
    console.error("[stripe] failed to load charge for session", sessionId, e);
    return null;
  });

  await db.update(orders)
    .set({
      paymentStatus: "paid",
      status: "paid",
      payoutStatus: "held",
      buyerProtection: true,
      ...(charge ? { stripeChargeId: charge } : {}),
    })
    .where(eq(orders.stripeSessionId, sessionId));

  const notices = new Map<number, string>();
  for (const o of rows) {
    notices.set(o.sellerId, `Payment confirmed for order #${o.id}. Ship the item — your payout is released after delivery is confirmed.`);
    notices.set(o.buyerId, `Your payment for order #${o.id} was confirmed. Funds are held securely until you receive your order (buyer protection).`);
  }
  for (const [userId, message] of Array.from(notices.entries())) {
    await db.insert(notifications).values({
      userId,
      type: "order_update",
      title: "Payment confirmed",
      message,
      entityType: "order",
      entityId: String(rows[0].id),
    });
  }
  return rows.length;
}

/**
 * Sellers in the buyer's cart whose stores can't receive card payouts yet.
 * Used to gate on-platform card checkout.
 */
export async function getUnpayableCartSellers(buyerId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(cartItems).where(eq(cartItems.userId, buyerId));
  const sellerIds = new Set<number>();
  for (const it of items) {
    if (it.listingId) {
      const [l] = await db.select({ sellerId: listings.sellerId }).from(listings)
        .where(eq(listings.id, it.listingId)).limit(1);
      if (l) sellerIds.add(l.sellerId);
    } else if (it.productListingId) {
      const [pl] = await db.select({ sellerId: productListings.sellerId }).from(productListings)
        .where(eq(productListings.id, it.productListingId)).limit(1);
      if (pl) sellerIds.add(pl.sellerId);
    }
  }
  if (sellerIds.size === 0) return [];
  const ids = Array.from(sellerIds);
  const stores = await db.select().from(sellerStores).where(inArray(sellerStores.userId, ids));
  const bad: string[] = [];
  for (const id of ids) {
    const store = stores.find((st) => st.userId === id);
    if (!store || !store.stripeAccountId || !store.stripePayoutsEnabled) {
      const [u] = await db.select({ name: users.name, username: users.username }).from(users)
        .where(eq(users.id, id)).limit(1);
      bad.push(store?.storeName ?? u?.username ?? u?.name ?? `seller #${id}`);
    }
  }
  return bad;
}

const PLATFORM_FEE = 0.05;

/** 95% of the order total, computed in integer cents (no float drift). */
export function sellerShareCents(totalUsd: string | number): number {
  const totalCents = Math.round(parseFloat(String(totalUsd)) * 100);
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

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");
  if (order.payoutStatus !== "held") return false; // already released/refunded → no-op
  const pastWindow = order.autoReleaseAt !== null && order.autoReleaseAt <= new Date();
  const releasable =
    ["delivered", "completed"].includes(order.status) ||
    (order.status === "shipped" && pastWindow); // buyer never confirmed → 21-day fallback
  if (!releasable) throw new Error("Order is not delivered yet");

  // Ledger guard: if a payout row already exists for this order, never send again.
  const existing = await db.select().from(payouts).where(eq(payouts.orderId, orderId)).limit(1);
  if (existing[0] && existing[0].status !== "failed") return false;

  if (!stripeEnabled()) {
    // No Stripe (e.g. PayPal order) — just mark released so the state machine completes.
    await db.update(orders).set({ payoutStatus: "released" }).where(eq(orders.id, orderId));
    return true;
  }

  if (!order.stripeChargeId) throw new Error("Order has no Stripe charge attached");

  const [store] = await db.select().from(sellerStores)
    .where(eq(sellerStores.userId, order.sellerId)).limit(1);
  if (!store?.stripeAccountId || !store.stripePayoutsEnabled) {
    throw new Error(`Seller ${order.sellerId} has no payout account — funds stay on platform`);
  }

  const amountCents = sellerShareCents(order.totalUsd);
  if (amountCents <= 0) return false;

  // Ledger first (pending), then transfer, then mark sent + released.
  if (existing[0]) {
    await db.update(payouts).set({ status: "pending" }).where(eq(payouts.orderId, orderId));
  } else {
    await db.insert(payouts).values({ orderId, sellerId: order.sellerId, amountCents, status: "pending" });
  }

  let transferId: string;
  try {
    transferId = await createTransfer({
      amountCents,
      destination: store.stripeAccountId,
      sourceCharge: order.stripeChargeId,
      description: `TCG Arena payout — order #${orderId}`,
      idempotencyKey: `payout_order_${orderId}`, // Stripe-side duplicate protection
    });
  } catch (e) {
    await db.update(payouts).set({ status: "failed" }).where(eq(payouts.orderId, orderId));
    throw e;
  }

  await db.update(payouts).set({ stripeTransferId: transferId, status: "sent" })
    .where(eq(payouts.orderId, orderId));
  await db.update(orders).set({ payoutStatus: "released" }).where(eq(orders.id, orderId));

  await db.insert(notifications).values({
    userId: order.sellerId,
    type: "order_update",
    title: "Payout sent",
    message: `$${(amountCents / 100).toFixed(2)} for order #${orderId} was sent to your Stripe account (95% of the sale — 5% platform fee).`,
    entityType: "order",
    entityId: String(orderId),
  });
  console.log(`[stripe] released ${amountCents}c to seller ${order.sellerId} for order #${orderId} (${transferId})`);
  return true;
}

/**
 * Refund the buyer in full (cancellation/dispute BEFORE release).
 * Only acts while funds are still held.
 */
export async function refundOrderMoney(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.payoutStatus !== "held") return false;

  if (stripeEnabled() && order.stripeChargeId && order.paymentStatus === "paid") {
    await createRefund(order.stripeChargeId, `refund_order_${orderId}`);
  }
  await db.update(orders)
    .set({ payoutStatus: "refunded", paymentStatus: "refunded" })
    .where(eq(orders.id, orderId));

  await db.insert(notifications).values({
    userId: order.buyerId,
    type: "order_update",
    title: "Refund issued",
    message: `Order #${orderId} was refunded in full to your original payment method (5-10 business days).`,
    entityType: "order",
    entityId: String(orderId),
  });
  console.log(`[stripe] refunded order #${orderId} (charge ${order.stripeChargeId ?? "n/a"})`);
  return true;
}

/** Fetch a single order by id. */
export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return order ?? null;
}

/** Orders whose escrow is due for automatic release (delivered + window passed). */
export async function getOrdersDueForRelease(): Promise<{ id: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: orders.id }).from(orders).where(and(
    eq(orders.payoutStatus, "held"),
    inArray(orders.status, ["delivered", "shipped"]),
    lte(orders.autoReleaseAt, new Date()),
  ));
}

// ─── Admin: escrow reconciliation ────────────────────────────────────────────

/** Snapshot of the escrow state for the admin panel. */
export async function getEscrowOverview() {
  const db = await getDb();
  if (!db) return { held: [], disputed: [], ledger: [], totals: { heldCents: 0, releasedCents: 0 } };

  const paidOrders = await db.select().from(orders)
    .where(eq(orders.paymentStatus, "paid"))
    .orderBy(desc(orders.createdAt)).limit(200);

  const held = paidOrders.filter(o => o.payoutStatus === "held" && o.status !== "disputed");
  const disputed = paidOrders.filter(o => o.status === "disputed" && o.payoutStatus === "held");
  const ledger = await db.select().from(payouts).orderBy(desc(payouts.createdAt)).limit(100);

  const heldCents = held.reduce((s, o) => s + sellerShareCents(o.totalUsd), 0);
  const releasedCents = ledger.filter(p => p.status === "sent").reduce((s, p) => s + p.amountCents, 0);

  return { held, disputed, ledger, totals: { heldCents, releasedCents } };
}

/**
 * Admin resolves a dispute while funds are held:
 *  - refund_buyer  → full Stripe refund, order cancelled
 *  - release_seller → escrow released to the seller
 */
export async function adminResolveDispute(
  orderId: number,
  resolution: "refund_buyer" | "release_seller",
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");
  if (order.status !== "disputed") throw new Error("Order is not disputed");
  if (order.payoutStatus !== "held") throw new Error("Funds are no longer held for this order");

  if (resolution === "refund_buyer") {
    await refundOrderMoney(orderId);
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
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
    await db.update(orders).set({ status: "delivered" }).where(eq(orders.id, orderId));
    await releaseOrder(orderId);
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
