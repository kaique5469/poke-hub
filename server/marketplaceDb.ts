/**
 * Marketplace data layer — products, listings, cart, orders, reviews,
 * notifications, bazaar and want lists.
 *
 * Every mutation that touches more than one table runs inside a transaction.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  notLike,
  or,
  sql,
} from "drizzle-orm";
import {
  bazaarListings,
  cartItems,
  listings,
  notifications,
  orders,
  productListings,
  products,
  sellerReviews,
  users,
  wantListItems,
  type InsertBazaarListing,
  type InsertProduct,
  type InsertWantListItem,
} from "../drizzle/schema";
import { getDb } from "./db";

type Condition = "M" | "NM" | "SP" | "MP" | "HP" | "D";

// ─── Seller summary shape (joined onto listings) ─────────────────────────────
const sellerCols = {
  sellerName: users.name,
  sellerUsername: users.username,
  sellerAvatarUrl: users.avatarUrl,
  sellerLocation: users.location,
  sellerRating: users.sellerRating,
  sellerTotalSales: users.totalSales,
  sellerIsVerified: users.isVerifiedSeller,
  sellerHasPhysicalStore: users.hasPhysicalStore,
} as const;

// ─── Card listings (singles) ──────────────────────────────────────────────────

export interface SearchListingsInput {
  q?: string;
  cardId?: string;
  sellerId?: number;
  conditions?: Condition[];
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  foilOnly?: boolean;
  sort?: "price_asc" | "price_desc" | "newest" | "views";
  page?: number;
  pageSize?: number;
}

export async function searchListings(input: SearchListingsInput) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 24, 60);

  const where = and(
    eq(listings.status, "active"),
    input.cardId ? eq(listings.cardId, input.cardId) : undefined,
    input.sellerId ? eq(listings.sellerId, input.sellerId) : undefined,
    input.q ? like(listings.cardName, `%${input.q}%`) : undefined,
    input.conditions?.length
      ? inArray(listings.condition, input.conditions)
      : undefined,
    input.language ? eq(listings.language, input.language) : undefined,
    input.minPrice !== undefined
      ? gte(listings.priceUsd, input.minPrice.toFixed(2))
      : undefined,
    input.maxPrice !== undefined
      ? lte(listings.priceUsd, input.maxPrice.toFixed(2))
      : undefined,
    input.foilOnly ? eq(listings.isFoil, true) : undefined
  );

  const orderBy =
    input.sort === "price_desc"
      ? desc(listings.priceUsd)
      : input.sort === "newest"
        ? desc(listings.createdAt)
        : input.sort === "views"
          ? desc(listings.viewCount)
          : asc(listings.priceUsd);

  const [items, totalRows] = await Promise.all([
    db
      .select({ listing: listings, ...sellerCols })
      .from(listings)
      .leftJoin(users, eq(listings.sellerId, users.id))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(where),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

/** All active listings for one card, cheapest first, with seller info. */
export async function getListingsByCardWithSeller(cardId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ listing: listings, ...sellerCols })
    .from(listings)
    .leftJoin(users, eq(listings.sellerId, users.id))
    .where(and(eq(listings.cardId, cardId), eq(listings.status, "active")))
    .orderBy(asc(listings.priceUsd))
    .limit(100);
}

export async function updateListing(
  id: number,
  sellerId: number,
  data: Partial<{
    priceUsd: string;
    quantity: number;
    condition: Condition;
    notes: string | null;
    status: "active" | "cancelled";
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(listings)
    .set(data)
    .where(and(eq(listings.id, id), eq(listings.sellerId, sellerId)));
}

// ─── Products (sealed / accessories) ─────────────────────────────────────────

export interface ListProductsInput {
  q?: string;
  category?: string;
  setId?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "views";
  page?: number;
  pageSize?: number;
}

function verifiedOrSellerListedProduct() {
  return or(
    like(products.slug, "scrydex-%"),
    sql<boolean>`exists (
      select 1 from ${productListings}
      where ${productListings.productId} = ${products.id}
        and ${productListings.status} = 'active'
    )`
  );
}

export async function listProducts(input: ListProductsInput) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 24, 60);

  const where = and(
    eq(products.isActive, true),
    verifiedOrSellerListedProduct(),
    input.q ? like(products.name, `%${input.q}%`) : undefined,
    input.category ? eq(products.category, input.category as never) : undefined,
    input.setId ? eq(products.setId, input.setId) : undefined
  );

  const orderBy =
    input.sort === "price_asc"
      ? asc(products.avgPriceUsd)
      : input.sort === "price_desc"
        ? desc(products.avgPriceUsd)
        : input.sort === "views"
          ? desc(products.viewCount)
          : desc(products.createdAt);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(where),
  ]);
  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.slug, slug),
        eq(products.isActive, true),
        verifiedOrSellerListedProduct()
      )
    )
    .limit(1);
  if (rows[0]) {
    await db
      .update(products)
      .set({ viewCount: sql`viewCount + 1` } as never)
      .where(eq(products.id, rows[0].id));
  }
  return rows[0];
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return rows[0];
}

export async function countProducts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(products);
  return Number(rows[0]?.count ?? 0);
}

/** Idempotent by slug and refreshes mutable catalog fields on every sync. */
export async function upsertProductBySlug(data: InsertProduct) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(products)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        category: data.category,
        language: data.language ?? "English",
        setId: data.setId ?? null,
        setName: data.setName ?? null,
        minPriceUsd: data.minPriceUsd ?? null,
        avgPriceUsd: data.avgPriceUsd ?? null,
        maxPriceUsd: data.maxPriceUsd ?? null,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      },
    });
}

/**
 * Hide the old generated catalog once real products exist. Products referenced
 * by a seller listing remain visible so no marketplace inventory is orphaned.
 */
export async function deactivateLegacyCatalogProducts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [legacy, referenced] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(notLike(products.slug, "scrydex-%")),
    db.select({ productId: productListings.productId }).from(productListings),
  ]);
  const protectedIds = new Set(referenced.map(row => row.productId));
  const ids = legacy.map(row => row.id).filter(id => !protectedIds.has(id));
  if (ids.length === 0) return 0;
  await db
    .update(products)
    .set({ isActive: false })
    .where(inArray(products.id, ids));
  return ids.length;
}

// ─── Product listings (sellers offering a sealed product) ───────────────────

export async function getProductListings(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ listing: productListings, ...sellerCols })
    .from(productListings)
    .leftJoin(users, eq(productListings.sellerId, users.id))
    .where(
      and(
        eq(productListings.productId, productId),
        eq(productListings.status, "active")
      )
    )
    .orderBy(asc(productListings.priceUsd))
    .limit(100);
}

export async function createProductListing(data: {
  productId: number;
  sellerId: number;
  priceUsd: string;
  quantity: number;
  condition?: Condition;
  language?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(productListings).values(data);
  return result;
}

export async function getUserProductListings(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      listing: productListings,
      productName: products.name,
      productImageUrl: products.imageUrl,
      productSlug: products.slug,
    })
    .from(productListings)
    .leftJoin(products, eq(productListings.productId, products.id))
    .where(eq(productListings.sellerId, sellerId))
    .orderBy(desc(productListings.createdAt));
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export async function getCartWithDetails(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      item: cartItems,
      cardListing: listings,
      productListing: productListings,
      productName: products.name,
      productImageUrl: products.imageUrl,
      productSlug: products.slug,
    })
    .from(cartItems)
    .leftJoin(listings, eq(cartItems.listingId, listings.id))
    .leftJoin(
      productListings,
      eq(cartItems.productListingId, productListings.id)
    )
    .leftJoin(products, eq(productListings.productId, products.id))
    .where(eq(cartItems.userId, userId))
    .orderBy(desc(cartItems.addedAt));

  // Attach seller info in one extra query
  const sellerIds = Array.from(
    new Set(
      rows
        .map(r => r.cardListing?.sellerId ?? r.productListing?.sellerId)
        .filter((v): v is number => typeof v === "number")
    )
  );
  const sellers = sellerIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          sellerRating: users.sellerRating,
        })
        .from(users)
        .where(inArray(users.id, sellerIds))
    : [];
  const sellerMap = new Map(sellers.map(s => [s.id, s]));
  return rows.map(r => ({
    ...r,
    seller:
      sellerMap.get(
        (r.cardListing?.sellerId ?? r.productListing?.sellerId) as number
      ) ?? null,
  }));
}

export async function addToCart(
  userId: number,
  ref: { listingId?: number; productListingId?: number },
  quantity: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const where = and(
    eq(cartItems.userId, userId),
    ref.listingId ? eq(cartItems.listingId, ref.listingId) : undefined,
    ref.productListingId
      ? eq(cartItems.productListingId, ref.productListingId)
      : undefined
  );
  const existing = await db.select().from(cartItems).where(where).limit(1);
  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({
      userId,
      listingId: ref.listingId ?? null,
      productListingId: ref.productListingId ?? null,
      quantity,
    });
  }
}

export async function updateCartItem(
  userId: number,
  cartItemId: number,
  quantity: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (quantity <= 0) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
  }
}

export async function clearCart(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

export async function getCartCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`coalesce(sum(quantity), 0)` })
    .from(cartItems)
    .where(eq(cartItems.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

// ─── Checkout / Orders ────────────────────────────────────────────────────────

export interface CheckoutResult {
  orderIds: number[];
  totalUsd: number;
  skipped: { reason: string; cartItemId: number }[];
}

/**
 * Creates one order per cart line (grouped visually by seller on the client),
 * decrements stock, marks sold-out listings, clears the cart and notifies
 * each seller — all inside a single transaction.
 */
export async function checkoutCart(
  buyerId: number,
  notes?: string
): Promise<CheckoutResult> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async tx => {
    const items = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, buyerId));
    if (items.length === 0) throw new Error("Cart is empty");

    const orderIds: number[] = [];
    const skipped: CheckoutResult["skipped"] = [];
    let totalUsd = 0;
    const sellerTotals = new Map<number, number>();

    for (const item of items) {
      if (item.listingId) {
        const [l] = await tx
          .select()
          .from(listings)
          .where(eq(listings.id, item.listingId))
          .for("update");
        if (!l || l.status !== "active" || l.quantity < item.quantity) {
          skipped.push({
            cartItemId: item.id,
            reason: "Listing unavailable or insufficient stock",
          });
          continue;
        }
        if (l.sellerId === buyerId) {
          skipped.push({
            cartItemId: item.id,
            reason: "Cannot buy your own listing",
          });
          continue;
        }
        const lineTotal = parseFloat(String(l.priceUsd)) * item.quantity;
        const [res] = await tx.insert(orders).values({
          buyerId,
          sellerId: l.sellerId,
          listingId: l.id,
          quantity: item.quantity,
          totalUsd: lineTotal.toFixed(2),
          status: "pending",
          notes: notes ?? null,
        });
        orderIds.push(res.insertId);
        totalUsd += lineTotal;
        sellerTotals.set(
          l.sellerId,
          (sellerTotals.get(l.sellerId) ?? 0) + lineTotal
        );

        const remaining = l.quantity - item.quantity;
        await tx
          .update(listings)
          .set({
            quantity: remaining,
            status: remaining <= 0 ? "sold" : "active",
          })
          .where(eq(listings.id, l.id));
      } else if (item.productListingId) {
        const [pl] = await tx
          .select()
          .from(productListings)
          .where(eq(productListings.id, item.productListingId))
          .for("update");
        if (!pl || pl.status !== "active" || pl.quantity < item.quantity) {
          skipped.push({
            cartItemId: item.id,
            reason: "Listing unavailable or insufficient stock",
          });
          continue;
        }
        if (pl.sellerId === buyerId) {
          skipped.push({
            cartItemId: item.id,
            reason: "Cannot buy your own listing",
          });
          continue;
        }
        const lineTotal = parseFloat(String(pl.priceUsd)) * item.quantity;
        const [res] = await tx.insert(orders).values({
          buyerId,
          sellerId: pl.sellerId,
          productListingId: pl.id,
          quantity: item.quantity,
          totalUsd: lineTotal.toFixed(2),
          status: "pending",
          notes: notes ?? null,
        });
        orderIds.push(res.insertId);
        totalUsd += lineTotal;
        sellerTotals.set(
          pl.sellerId,
          (sellerTotals.get(pl.sellerId) ?? 0) + lineTotal
        );

        const remaining = pl.quantity - item.quantity;
        await tx
          .update(productListings)
          .set({
            quantity: remaining,
            status: remaining <= 0 ? "sold" : "active",
          })
          .where(eq(productListings.id, pl.id));
      }
    }

    if (orderIds.length === 0) {
      throw new Error(skipped[0]?.reason ?? "No purchasable items in cart");
    }

    await tx.delete(cartItems).where(eq(cartItems.userId, buyerId));

    // Notify each seller inside the same transaction
    for (const [sellerId, amount] of Array.from(sellerTotals.entries())) {
      await tx.insert(notifications).values({
        userId: sellerId,
        type: "order_update",
        title: "New order received",
        message: `You received a new order totaling $${amount.toFixed(2)}. Contact the buyer to arrange payment and shipping.`,
        entityType: "order",
        entityId: String(orderIds[0]),
      });
    }

    return { orderIds, totalUsd, skipped };
  });
}

const orderJoinCols = {
  order: orders,
  cardListing: listings,
  productListing: productListings,
  productName: products.name,
  productImageUrl: products.imageUrl,
} as const;

export async function getBuyerOrders(buyerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      ...orderJoinCols,
      counterpartyName: users.name,
      counterpartyUsername: users.username,
    })
    .from(orders)
    .leftJoin(listings, eq(orders.listingId, listings.id))
    .leftJoin(productListings, eq(orders.productListingId, productListings.id))
    .leftJoin(products, eq(productListings.productId, products.id))
    .leftJoin(users, eq(orders.sellerId, users.id))
    .where(eq(orders.buyerId, buyerId))
    .orderBy(desc(orders.createdAt));
  return rows;
}

export async function getSellerOrders(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      ...orderJoinCols,
      counterpartyName: users.name,
      counterpartyUsername: users.username,
    })
    .from(orders)
    .leftJoin(listings, eq(orders.listingId, listings.id))
    .leftJoin(productListings, eq(orders.productListingId, productListings.id))
    .leftJoin(products, eq(productListings.productId, products.id))
    .leftJoin(users, eq(orders.buyerId, users.id))
    .where(eq(orders.sellerId, sellerId))
    .orderBy(desc(orders.createdAt));
  return rows;
}

const SELLER_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: [],
  delivered: [],
  cancelled: [],
  disputed: [],
};
const BUYER_TRANSITIONS: Record<string, string[]> = {
  pending: ["cancelled"],
  paid: ["disputed"],
  shipped: ["delivered", "disputed"],
  delivered: ["disputed"], // dispute window while escrow is held (blocked after release)
  cancelled: [],
  disputed: [],
};

export async function updateOrderStatus(
  orderId: number,
  userId: number,
  newStatus: "paid" | "shipped" | "delivered" | "cancelled" | "disputed",
  trackingNumber?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async tx => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new Error("Order not found");

    const isSeller = order.sellerId === userId;
    const isBuyer = order.buyerId === userId;
    if (!isSeller && !isBuyer) throw new Error("Not your order");

    const allowed = isSeller
      ? SELLER_TRANSITIONS[order.status]
      : BUYER_TRANSITIONS[order.status];
    if (!allowed?.includes(newStatus)) {
      throw new Error(
        `Cannot change order from "${order.status}" to "${newStatus}"`
      );
    }

    // ESCROW: once the payout was released to the seller, disputes go through
    // support — the money is no longer held by the platform.
    if (newStatus === "disputed" && order.payoutStatus === "released") {
      throw new Error(
        "The payment for this order was already released. Contact support to open a claim."
      );
    }

    await tx
      .update(orders)
      .set({
        status: newStatus,
        trackingNumber: trackingNumber ?? order.trackingNumber,
      })
      .where(eq(orders.id, orderId));

    // ESCROW schedule:
    //  - shipped   → fallback auto-release in 21 days (protects seller if buyer never confirms)
    //  - delivered → buyer confirmed receipt of package; auto-release in 7 days
    //    (buyer can still dispute in that window; "Confirm receipt" releases instantly)
    if (newStatus === "shipped") {
      await tx
        .update(orders)
        .set({ autoReleaseAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) })
        .where(eq(orders.id, orderId));
    }
    if (newStatus === "delivered") {
      await tx
        .update(orders)
        .set({
          deliveredAt: new Date(),
          autoReleaseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .where(eq(orders.id, orderId));
    }
    // Dispute freezes the escrow clock (status leaves shipped/delivered, so the
    // auto-release query no longer matches it).

    // Restock on cancellation
    if (newStatus === "cancelled") {
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
    }

    // Seller sale counter on delivery
    if (newStatus === "delivered") {
      await tx
        .update(users)
        .set({ totalSales: sql`totalSales + 1` as never })
        .where(eq(users.id, order.sellerId));
    }

    // Notify the other party
    const notifyUserId = isSeller ? order.buyerId : order.sellerId;
    await tx.insert(notifications).values({
      userId: notifyUserId,
      type: "order_update",
      title: `Order #${orderId} ${newStatus}`,
      message: `Order #${orderId} status changed to "${newStatus}".`,
      entityType: "order",
      entityId: String(orderId),
    });

    return { previous: order.status, current: newStatus };
  });
}

// ─── Seller reviews ───────────────────────────────────────────────────────────

export async function addSellerReview(
  reviewerId: number,
  orderId: number,
  rating: number,
  comment?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  return db.transaction(async tx => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) throw new Error("Order not found");
    if (order.buyerId !== reviewerId)
      throw new Error("Only the buyer can review this order");
    if (order.status !== "delivered")
      throw new Error("You can only review delivered orders");

    const existing = await tx
      .select({ id: sellerReviews.id })
      .from(sellerReviews)
      .where(eq(sellerReviews.orderId, orderId))
      .limit(1);
    if (existing.length > 0) throw new Error("This order was already reviewed");

    await tx.insert(sellerReviews).values({
      sellerId: order.sellerId,
      reviewerId,
      rating,
      comment: comment ?? null,
      orderId,
    });

    // Recompute seller average
    const [agg] = await tx
      .select({ avg: sql<string>`avg(rating)` })
      .from(sellerReviews)
      .where(eq(sellerReviews.sellerId, order.sellerId));
    await tx
      .update(users)
      .set({ sellerRating: parseFloat(agg?.avg ?? "0").toFixed(2) })
      .where(eq(users.id, order.sellerId));
  });
}

export async function getSellerReviews(sellerId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      review: sellerReviews,
      reviewerName: users.name,
      reviewerUsername: users.username,
      reviewerAvatarUrl: users.avatarUrl,
    })
    .from(sellerReviews)
    .leftJoin(users, eq(sellerReviews.reviewerId, users.id))
    .where(eq(sellerReviews.sellerId, sellerId))
    .orderBy(desc(sellerReviews.createdAt))
    .limit(limit);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(
  userId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );
  return Number(rows[0]?.count ?? 0);
}

export async function markNotificationsRead(userId: number, ids?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        ids?.length ? inArray(notifications.id, ids) : undefined
      )
    );
}

export async function createNotification(data: {
  userId: number;
  type:
    | "auction_bid"
    | "auction_won"
    | "order_update"
    | "price_alert"
    | "drop_alert"
    | "bazaar_match";
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    ...data,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
  });
}

// ─── Bazaar (trade / sale) + Want list ───────────────────────────────────────

export async function getBazaarListings(input: {
  q?: string;
  forTrade?: boolean;
  forSale?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 24, 60);

  const where = and(
    input.q ? like(bazaarListings.cardName, `%${input.q}%`) : undefined,
    input.forTrade ? eq(bazaarListings.isForTrade, true) : undefined,
    input.forSale ? eq(bazaarListings.isForSale, true) : undefined
  );

  const [items, totalRows] = await Promise.all([
    db
      .select({
        bazaarItem: bazaarListings,
        ownerName: users.name,
        ownerUsername: users.username,
        ownerAvatarUrl: users.avatarUrl,
        ownerLocation: users.location,
        ownerRating: users.sellerRating,
      })
      .from(bazaarListings)
      .leftJoin(users, eq(bazaarListings.userId, users.id))
      .where(where)
      .orderBy(desc(bazaarListings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bazaarListings)
      .where(where),
  ]);
  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function getUserBazaarListings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bazaarListings)
    .where(eq(bazaarListings.userId, userId))
    .orderBy(desc(bazaarListings.createdAt));
}

export async function createBazaarListing(data: InsertBazaarListing) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(bazaarListings).values(data);
  return result;
}

export async function deleteBazaarListing(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(bazaarListings)
    .where(and(eq(bazaarListings.id, id), eq(bazaarListings.userId, userId)));
}

export async function getUserWantList(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(wantListItems)
    .where(eq(wantListItems.userId, userId))
    .orderBy(desc(wantListItems.addedAt));
}

export async function addWantListItem(data: InsertWantListItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(wantListItems).values(data);
  return result;
}

export async function removeWantListItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(wantListItems)
    .where(and(eq(wantListItems.id, id), eq(wantListItems.userId, userId)));
}

/**
 * Cross-matching: cards on MY want list that OTHER users have posted in the
 * bazaar, and cards I posted that other users want.
 */
export async function getBazaarMatches(userId: number) {
  const db = await getDb();
  if (!db) return { theyHave: [], theyWant: [] };

  const myWants = await db
    .select()
    .from(wantListItems)
    .where(eq(wantListItems.userId, userId));
  const myCards = await db
    .select()
    .from(bazaarListings)
    .where(eq(bazaarListings.userId, userId));

  const wantedCardIds = myWants.map(w => w.cardId);
  const offeredCardIds = myCards.map(c => c.cardId);

  const [theyHave, theyWant] = await Promise.all([
    wantedCardIds.length
      ? db
          .select({
            bazaarItem: bazaarListings,
            ownerName: users.name,
            ownerUsername: users.username,
            ownerLocation: users.location,
            ownerRating: users.sellerRating,
          })
          .from(bazaarListings)
          .leftJoin(users, eq(bazaarListings.userId, users.id))
          .where(
            and(
              inArray(bazaarListings.cardId, wantedCardIds),
              sql`${bazaarListings.userId} != ${userId}`
            )
          )
          .limit(50)
      : Promise.resolve([]),
    offeredCardIds.length
      ? db
          .select({
            wantItem: wantListItems,
            ownerName: users.name,
            ownerUsername: users.username,
            ownerLocation: users.location,
            ownerRating: users.sellerRating,
          })
          .from(wantListItems)
          .leftJoin(users, eq(wantListItems.userId, users.id))
          .where(
            and(
              inArray(wantListItems.cardId, offeredCardIds),
              sql`${wantListItems.userId} != ${userId}`
            )
          )
          .limit(50)
      : Promise.resolve([]),
  ]);

  return { theyHave, theyWant };
}

// ─── Top carousels for the Bazaar page ───────────────────────────────────────

export async function getTopWantedCards(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      cardId: wantListItems.cardId,
      cardName: wantListItems.cardName,
      imageUrl: sql<string>`max(${wantListItems.imageUrl})`,
      wantCount: sql<number>`count(*)`,
    })
    .from(wantListItems)
    .groupBy(wantListItems.cardId, wantListItems.cardName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function getTopTradeCards(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      cardId: bazaarListings.cardId,
      cardName: bazaarListings.cardName,
      imageUrl: sql<string>`max(${bazaarListings.imageUrl})`,
      tradeCount: sql<number>`count(*)`,
    })
    .from(bazaarListings)
    .where(eq(bazaarListings.isForTrade, true))
    .groupBy(bazaarListings.cardId, bazaarListings.cardName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
