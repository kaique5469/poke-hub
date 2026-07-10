/** DB helpers for seller stores + Stripe payment status. */
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  cartItems,
  listings,
  notifications,
  orders,
  productListings,
  products,
  sellerStores,
  users,
  type InsertSellerStore,
  type SellerStore,
} from "../drizzle/schema";
import { getDb } from "./db";
import { createTransfer, getSessionCharge, stripeEnabled } from "./lib/stripe";

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

/** Mark all orders of a Stripe session as paid + notify buyer/sellers. */
export async function markOrdersPaid(sessionId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
  if (rows.length === 0) return 0;

  await db.update(orders)
    .set({ paymentStatus: "paid", status: "paid", buyerProtection: true })
    .where(eq(orders.stripeSessionId, sessionId));

  const notices = new Map<number, string>();
  for (const o of rows) {
    notices.set(o.sellerId, `Payment confirmed for order #${o.id}. Ship the item to keep your seller rating high.`);
    notices.set(o.buyerId, `Your payment for order #${o.id} was confirmed. The seller has been notified.`);
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

/**
 * Transfer each seller's share (95%) of a paid Stripe session directly to
 * their connected account. Failures are logged and skipped — funds stay on
 * the platform balance for manual resolution.
 */
export async function payoutSellers(sessionId: string): Promise<void> {
  if (!stripeEnabled()) return;
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
  if (rows.length === 0) return;

  const totals = new Map<number, number>();
  for (const o of rows) {
    totals.set(o.sellerId, (totals.get(o.sellerId) ?? 0) + parseFloat(String(o.totalUsd)));
  }

  let charge: string | null = null;
  try {
    charge = await getSessionCharge(sessionId);
  } catch (e) {
    console.error("[stripe] failed to load charge for session", sessionId, e);
    return;
  }
  if (!charge) return;

  const stores = await db.select().from(sellerStores)
    .where(inArray(sellerStores.userId, Array.from(totals.keys())));

  for (const [sellerId, total] of Array.from(totals.entries())) {
    const store = stores.find((st) => st.userId === sellerId);
    if (!store?.stripeAccountId || !store.stripePayoutsEnabled) {
      console.error(`[stripe] seller ${sellerId} has no payout account — keeping funds on platform`);
      continue;
    }
    const amountCents = Math.round(total * (1 - PLATFORM_FEE) * 100);
    if (amountCents <= 0) continue;
    try {
      const transferId = await createTransfer({
        amountCents,
        destination: store.stripeAccountId,
        sourceCharge: charge,
        description: `TCG Arena payout — session ${sessionId}`,
      });
      console.log(`[stripe] transferred ${amountCents}c to seller ${sellerId} (${transferId})`);
      await db.insert(notifications).values({
        userId: sellerId,
        type: "order_update",
        title: "Payout sent",
        message: `$${(amountCents / 100).toFixed(2)} was sent to your connected Stripe account (95% of the sale — 5% platform fee).`,
        entityType: "order",
        entityId: sessionId,
      });
    } catch (e) {
      console.error(`[stripe] transfer to seller ${sellerId} failed`, e);
    }
  }
}
