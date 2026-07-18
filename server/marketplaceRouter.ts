/**
 * Marketplace tRPC routers — products, listings, cart, orders, reviews,
 * notifications, bazaar and want list.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addSellerReview,
  addToCart,
  addWantListItem,
  checkoutCart,
  clearCart,
  createBazaarListing,
  createProductListing,
  deleteBazaarListing,
  getBazaarListings,
  getBazaarMatches,
  getBuyerOrders,
  getCartCount,
  getCartWithDetails,
  getProductBySlug,
  getProductListings,
  getSellerOrders,
  getSellerReviews,
  getTopTradeCards,
  getTopWantedCards,
  getUnreadNotificationCount,
  getUserBazaarListings,
  getUserNotifications,
  getUserProductListings,
  getUserWantList,
  listProducts,
  markNotificationsRead,
  removeWantListItem,
  searchListings,
  updateCartItem,
  updateListing,
  updateOrderStatus,
} from "./marketplaceDb";
import {
  attachStripeSession,
  cancelReservedOrders,
  getUnpayableCartSellers,
  getOrderById,
  releaseOrder,
  refundOrderMoney,
  requireSellerReady,
} from "./storeDb";
import { MARKETPLACE_TERMS_VERSION } from "@shared/marketplace";
import {
  createCheckoutSession,
  expireCheckoutSession,
  stripeEnabled,
} from "./lib/stripe";
import { ensureProductsSynced, getCatalogSyncStatus } from "./scrydexSync";
import { getRetailerLinks } from "./lib/retailerLinks";

const conditionEnum = z.enum(["M", "NM", "SP", "MP", "HP", "D"]);

const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

/** Wraps db-layer errors (thrown as plain Error) into typed TRPC errors. */
async function rethrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw badRequest(err instanceof Error ? err.message : "Operation failed");
  }
}

// ─── Products & product listings ─────────────────────────────────────────────

export const productsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          category: z.string().optional(),
          setId: z.string().optional(),
          sort: z
            .enum(["newest", "price_asc", "price_desc", "views"])
            .optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(60).default(24),
        })
        .default({ page: 1, pageSize: 24 })
    )
    .query(async ({ input }) => {
      void ensureProductsSynced();
      return listProducts(input);
    }),

  status: publicProcedure.query(async () => {
    void ensureProductsSynced();
    return getCatalogSyncStatus();
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      void ensureProductsSynced();
      const product = await getProductBySlug(input.slug);
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      const [sellers, relatedResult] = await Promise.all([
        getProductListings(product.id),
        listProducts({
          ...(product.setId
            ? { setId: product.setId }
            : { category: product.category }),
          sort: "views",
          page: 1,
          pageSize: 8,
        }),
      ]);
      const related = relatedResult.items
        .filter(item => item.id !== product.id)
        .slice(0, 4);
      return {
        product,
        sellers,
        related,
        retailerLinks: getRetailerLinks(product.name),
      };
    }),

  createListing: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        priceUsd: z.number().positive().max(99999),
        quantity: z.number().int().min(1).max(999),
        condition: conditionEnum.default("NM"),
        language: z.string().max(32).default("English"),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(async () => {
        await requireSellerReady(ctx.user.id);
        return createProductListing({
          ...input,
          priceUsd: input.priceUsd.toFixed(2),
          sellerId: ctx.user.id,
        });
      })
    ),

  myListings: protectedProcedure.query(({ ctx }) =>
    getUserProductListings(ctx.user.id)
  ),
});

// ─── Card listings (singles) ──────────────────────────────────────────────────

export const listingsRouter = router({
  search: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          cardId: z.string().optional(),
          conditions: z.array(conditionEnum).optional(),
          language: z.string().optional(),
          minPrice: z.number().nonnegative().optional(),
          maxPrice: z.number().positive().optional(),
          foilOnly: z.boolean().optional(),
          sort: z
            .enum(["price_asc", "price_desc", "newest", "views"])
            .optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(60).default(24),
        })
        .default({ page: 1, pageSize: 24 })
    )
    .query(({ input }) => searchListings(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        priceUsd: z.number().positive().optional(),
        quantity: z.number().int().min(0).optional(),
        condition: conditionEnum.optional(),
        notes: z.string().max(1000).nullable().optional(),
        status: z.enum(["active", "cancelled"]).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(async () => {
        if (input.status !== "cancelled") {
          await requireSellerReady(ctx.user.id);
        }
        return updateListing(input.id, ctx.user.id, {
          ...(input.priceUsd !== undefined
            ? { priceUsd: input.priceUsd.toFixed(2) }
            : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.condition ? { condition: input.condition } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.status ? { status: input.status } : {}),
        });
      })
    ),
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartRouter = router({
  get: protectedProcedure.query(({ ctx }) => getCartWithDetails(ctx.user.id)),

  count: protectedProcedure.query(({ ctx }) => getCartCount(ctx.user.id)),

  add: protectedProcedure
    .input(
      z
        .object({
          listingId: z.number().int().positive().optional(),
          productListingId: z.number().int().positive().optional(),
          quantity: z.number().int().min(1).max(99).default(1),
        })
        .refine(v => !!v.listingId !== !!v.productListingId, {
          message: "Provide exactly one of listingId or productListingId",
        })
    )
    .mutation(({ input, ctx }) =>
      rethrow(() =>
        addToCart(
          ctx.user.id,
          {
            listingId: input.listingId,
            productListingId: input.productListingId,
          },
          input.quantity
        )
      )
    ),

  update: protectedProcedure
    .input(
      z.object({
        cartItemId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(99),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(() =>
        updateCartItem(ctx.user.id, input.cartItemId, input.quantity)
      )
    ),

  clear: protectedProcedure.mutation(({ ctx }) =>
    rethrow(() => clearCart(ctx.user.id))
  ),

  /** Stripe checkout: creates the orders then redirects to Stripe-hosted payment. */
  stripeCheckout: protectedProcedure
    .input(
      z.object({
        notes: z.string().max(1000).optional(),
        acceptMarketplaceTerms: z.literal(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!stripeEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Card payments are not available yet",
        });
      }
      const notReady = await getUnpayableCartSellers(ctx.user.id);
      if (notReady.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Checkout unavailable: ${notReady.join(", ")} ${notReady.length > 1 ? "haven't" : "hasn't"} completed payout setup. Remove those items and try again.`,
        });
      }
      const result = await rethrow(() =>
        checkoutCart(ctx.user.id, input.notes, MARKETPLACE_TERMS_VERSION)
      );
      const proto =
        (ctx.req.headers["x-forwarded-proto"] as string | undefined)?.split(
          ","
        )[0] ?? ctx.req.protocol;
      const origin = `${proto}://${ctx.req.get("host")}`;
      let session: Awaited<ReturnType<typeof createCheckoutSession>> | null = null;
      try {
        session = await createCheckoutSession({
          amountUsd: result.totalUsd,
          description: `RarityGrid order (${result.orderIds.length} item${result.orderIds.length > 1 ? "s" : ""})`,
          orderIds: result.orderIds,
          buyerEmail: ctx.user.email,
          origin,
        });
        await attachStripeSession(
          result.orderIds,
          session.id,
          session.expiresAt
        );
        await clearCart(ctx.user.id);
        return {
          checkoutUrl: session.url,
          orderIds: result.orderIds,
          skipped: result.skipped,
        };
      } catch (error) {
        if (session) {
          await expireCheckoutSession(session.id).catch(expireError =>
            console.error("[stripe] failed to expire incomplete session", expireError)
          );
        }
        await cancelReservedOrders(
          result.orderIds,
          "Secure checkout could not be created"
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Secure checkout could not be created",
        });
      }
    }),

  stripeAvailable: publicProcedure.query(() => stripeEnabled()),

  checkout: protectedProcedure
    .input(z.object({ notes: z.string().max(2000).optional() }).default({}))
    .mutation(() => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Off-platform checkout is disabled. Use secure card checkout.",
      });
    }),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersRouter = router({
  myPurchases: protectedProcedure.query(({ ctx }) =>
    getBuyerOrders(ctx.user.id)
  ),
  mySales: protectedProcedure.query(({ ctx }) => getSellerOrders(ctx.user.id)),

  updateStatus: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        status: z.enum(["shipped", "delivered", "cancelled", "disputed"]),
        trackingNumber: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.status === "cancelled") {
        const order = await getOrderById(input.orderId);
        if (!order || (order.buyerId !== ctx.user.id && order.sellerId !== ctx.user.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        if (order.status === "paid") {
          if (order.sellerId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Buyers must open a dispute after payment",
            });
          }
          await rethrow(() => refundOrderMoney(input.orderId));
        }
      }
      return rethrow(() =>
        updateOrderStatus(
          input.orderId,
          ctx.user.id,
          input.status,
          input.trackingNumber
        )
      );
    }),

  /**
   * Buyer confirms everything is OK with a delivered order → releases the
   * escrow to the seller immediately (instead of waiting the 7-day window).
   */
  confirmReceipt: protectedProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(({ input, ctx }) =>
      rethrow(async () => {
        const order = await getOrderById(input.orderId);
        if (!order || order.buyerId !== ctx.user.id)
          throw new Error("Order not found");
        if (order.status !== "delivered")
          throw new Error("Order is not delivered yet");
        const released = await releaseOrder(input.orderId);
        return { released };
      })
    ),

  review: protectedProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(() =>
        addSellerReview(ctx.user.id, input.orderId, input.rating, input.comment)
      )
    ),

  sellerReviews: publicProcedure
    .input(
      z.object({
        sellerId: z.number().int().positive(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(({ input }) => getSellerReviews(input.sellerId, input.limit)),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    getUserNotifications(ctx.user.id)
  ),
  unreadCount: protectedProcedure.query(({ ctx }) =>
    getUnreadNotificationCount(ctx.user.id)
  ),
  markRead: protectedProcedure
    .input(
      z
        .object({ ids: z.array(z.number().int().positive()).optional() })
        .default({})
    )
    .mutation(({ input, ctx }) =>
      rethrow(() => markNotificationsRead(ctx.user.id, input.ids))
    ),
});

// ─── Bazaar + Want list ───────────────────────────────────────────────────────

export const bazaarRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          forTrade: z.boolean().optional(),
          forSale: z.boolean().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(60).default(24),
        })
        .default({ page: 1, pageSize: 24 })
    )
    .query(({ input }) => getBazaarListings(input)),

  topWanted: publicProcedure.query(() => getTopWantedCards()),
  topForTrade: publicProcedure.query(() => getTopTradeCards()),

  mine: protectedProcedure.query(({ ctx }) =>
    getUserBazaarListings(ctx.user.id)
  ),

  create: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        cardName: z.string().min(1).max(256),
        setId: z.string().optional(),
        setName: z.string().optional(),
        imageUrl: z.string().url().optional(),
        quantity: z.number().int().min(1).max(99).default(1),
        condition: conditionEnum.default("NM"),
        language: z.string().max(32).default("English"),
        priceUsd: z.number().positive().optional(),
        isForTrade: z.boolean().default(true),
        isForSale: z.boolean().default(false),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(() =>
        createBazaarListing({
          ...input,
          priceUsd: input.priceUsd?.toFixed(2) ?? null,
          userId: ctx.user.id,
        })
      )
    ),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input, ctx }) =>
      rethrow(() => deleteBazaarListing(input.id, ctx.user.id))
    ),

  matches: protectedProcedure.query(({ ctx }) => getBazaarMatches(ctx.user.id)),

  // Want list
  wantList: protectedProcedure.query(({ ctx }) => getUserWantList(ctx.user.id)),

  addWant: protectedProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        cardName: z.string().min(1).max(256),
        setId: z.string().optional(),
        imageUrl: z.string().url().optional(),
        quantity: z.number().int().min(1).max(99).default(1),
        condition: conditionEnum.default("NM"),
        maxPriceUsd: z.number().positive().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      rethrow(() =>
        addWantListItem({
          ...input,
          maxPriceUsd: input.maxPriceUsd?.toFixed(2) ?? null,
          userId: ctx.user.id,
        })
      )
    ),

  removeWant: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input, ctx }) =>
      rethrow(() => removeWantListItem(input.id, ctx.user.id))
    ),
});
