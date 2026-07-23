import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  username: varchar("username", { length: 64 }).unique(),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  location: varchar("location", { length: 128 }),
  sellerRating: decimal("sellerRating", { precision: 3, scale: 2 }).default(
    "0.00"
  ),
  totalSales: int("totalSales").default(0).notNull(),
  isVerifiedSeller: boolean("isVerifiedSeller").default(false).notNull(),
  hasPhysicalStore: boolean("hasPhysicalStore").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Binder / Collection ──────────────────────────────────────────────────────

export const binders = mysqlTable("binders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  coverImageUrl: text("coverImageUrl"),
  isPublic: boolean("isPublic").default(false).notNull(),
  totalValueUsd: decimal("totalValueUsd", { precision: 10, scale: 2 }).default(
    "0.00"
  ),
  cardCount: int("cardCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Binder = typeof binders.$inferSelect;
export type InsertBinder = typeof binders.$inferInsert;

export const binderCards = mysqlTable("binder_cards", {
  id: int("id").autoincrement().primaryKey(),
  binderId: int("binderId"),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setName: varchar("setName", { length: 256 }),
  setId: varchar("setId", { length: 64 }),
  imageUrl: text("imageUrl"),
  rarity: varchar("rarity", { length: 128 }),
  quantity: int("quantity").default(1).notNull(),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"])
    .default("NM")
    .notNull(),
  language: varchar("language", { length: 32 }).default("English"),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }),
  purchasePriceUsd: decimal("purchasePriceUsd", { precision: 10, scale: 2 }),
  acquiredAt: timestamp("acquiredAt"),
  acquisitionSource: varchar("acquisitionSource", { length: 32 }),
  gradingCompany: varchar("gradingCompany", { length: 16 }),
  grade: decimal("grade", { precision: 3, scale: 1 }),
  notes: text("notes"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BinderCard = typeof binderCards.$inferSelect;
export type InsertBinderCard = typeof binderCards.$inferInsert;

export const portfolioSnapshots = mysqlTable("portfolio_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  totalValueUsd: decimal("totalValueUsd", {
    precision: 14,
    scale: 2,
  }).notNull(),
  totalCostUsd: decimal("totalCostUsd", { precision: 14, scale: 2 }).notNull(),
  cardCount: int("cardCount").notNull(),
  pricedCards: int("pricedCards").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

// ─── Decks ────────────────────────────────────────────────────────────────────

export const decks = mysqlTable("decks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  format: mysqlEnum("format", ["standard", "expanded", "unlimited", "glc"])
    .default("standard")
    .notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 2 }),
  minCostUsd: decimal("minCostUsd", { precision: 10, scale: 2 }),
  maxCostUsd: decimal("maxCostUsd", { precision: 10, scale: 2 }),
  cardCount: int("cardCount").default(0).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  featuredCards: json("featuredCards"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;

export const deckCards = mysqlTable("deck_cards", {
  id: int("id").autoincrement().primaryKey(),
  deckId: int("deckId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setName: varchar("setName", { length: 256 }),
  setId: varchar("setId", { length: 64 }),
  imageUrl: text("imageUrl"),
  supertype: varchar("supertype", { length: 64 }),
  quantity: int("quantity").default(1).notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type DeckCard = typeof deckCards.$inferSelect;
export type InsertDeckCard = typeof deckCards.$inferInsert;

// ─── Marketplace Listings ─────────────────────────────────────────────────────

export const listings = mysqlTable("listings", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setId: varchar("setId", { length: 64 }),
  setName: varchar("setName", { length: 256 }),
  imageUrl: text("imageUrl"),
  condition: mysqlEnum("condition", [
    "M",
    "NM",
    "SP",
    "MP",
    "HP",
    "D",
  ]).notNull(),
  language: varchar("language", { length: 32 }).default("English").notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
  /** Listing price currency; priceUsd is retained as a legacy column name. */
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  quantity: int("quantity").default(1).notNull(),
  isFoil: boolean("isFoil").default(false).notNull(),
  isAltered: boolean("isAltered").default(false).notNull(),
  isFirstEdition: boolean("isFirstEdition").default(false).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "sold", "cancelled"])
    .default("active")
    .notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

// ─── Buy List ─────────────────────────────────────────────────────────────────

export const buyListItems = mysqlTable("buy_list_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setId: varchar("setId", { length: 64 }),
  setName: varchar("setName", { length: 256 }),
  imageUrl: text("imageUrl"),
  quantity: int("quantity").default(1).notNull(),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"])
    .default("NM")
    .notNull(),
  language: varchar("language", { length: 32 }).default("English"),
  maxPriceUsd: decimal("maxPriceUsd", { precision: 10, scale: 2 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type BuyListItem = typeof buyListItems.$inferSelect;
export type InsertBuyListItem = typeof buyListItems.$inferInsert;

// ─── Want List ────────────────────────────────────────────────────────────────

export const wantListItems = mysqlTable("want_list_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setId: varchar("setId", { length: 64 }),
  imageUrl: text("imageUrl"),
  quantity: int("quantity").default(1).notNull(),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"]).default(
    "NM"
  ),
  maxPriceUsd: decimal("maxPriceUsd", { precision: 10, scale: 2 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type WantListItem = typeof wantListItems.$inferSelect;
export type InsertWantListItem = typeof wantListItems.$inferInsert;

// ─── Auctions ─────────────────────────────────────────────────────────────────

export const auctions = mysqlTable("auctions", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  cardId: varchar("cardId", { length: 64 }),
  cardName: varchar("cardName", { length: 256 }),
  setId: varchar("setId", { length: 64 }),
  setName: varchar("setName", { length: 256 }),
  imageUrl: text("imageUrl"),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"])
    .default("NM")
    .notNull(),
  language: varchar("language", { length: 32 }).default("English").notNull(),
  isFoil: boolean("isFoil").default(false).notNull(),
  isPromo: boolean("isPromo").default(false).notNull(),
  isFirstEdition: boolean("isFirstEdition").default(false).notNull(),
  startingBidUsd: decimal("startingBidUsd", {
    precision: 10,
    scale: 2,
  }).notNull(),
  currentBidUsd: decimal("currentBidUsd", { precision: 10, scale: 2 }),
  fixedPriceUsd: decimal("fixedPriceUsd", { precision: 10, scale: 2 }),
  buyerProtection: boolean("buyerProtection").default(false).notNull(),
  bidCount: int("bidCount").default(0).notNull(),
  watchCount: int("watchCount").default(0).notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", ["active", "ended", "cancelled"])
    .default("active")
    .notNull(),
  winnerId: int("winnerId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = typeof auctions.$inferInsert;

export const auctionBids = mysqlTable("auction_bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  bidderId: int("bidderId").notNull(),
  amountUsd: decimal("amountUsd", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuctionBid = typeof auctionBids.$inferSelect;

export const auctionWatches = mysqlTable("auction_watches", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bazaar ───────────────────────────────────────────────────────────────────

export const bazaarListings = mysqlTable("bazaar_listings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 256 }).notNull(),
  setId: varchar("setId", { length: 64 }),
  setName: varchar("setName", { length: 256 }),
  imageUrl: text("imageUrl"),
  quantity: int("quantity").default(1).notNull(),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"])
    .default("NM")
    .notNull(),
  language: varchar("language", { length: 32 }).default("English"),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }),
  isForTrade: boolean("isForTrade").default(true).notNull(),
  isForSale: boolean("isForSale").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BazaarListing = typeof bazaarListings.$inferSelect;
export type InsertBazaarListing = typeof bazaarListings.$inferInsert;

// ─── Articles ─────────────────────────────────────────────────────────────────

export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  subtitle: text("subtitle"),
  slug: varchar("slug", { length: 512 }).notNull().unique(),
  coverImageUrl: text("coverImageUrl"),
  content: text("content").notNull(),
  category: mysqlEnum("category", [
    "strategy",
    "deck_guide",
    "set_review",
    "tournament",
    "collector",
    "news",
  ])
    .default("news")
    .notNull(),
  tags: json("tags"),
  viewCount: int("viewCount").default(0).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  entityType: mysqlEnum("entityType", [
    "card",
    "product",
    "article",
    "deck",
    "auction",
  ]).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ─── Products (Sealed / Accessories) ─────────────────────────────────────────

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 512 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  category: mysqlEnum("category", [
    "booster_pack",
    "booster_box",
    "etb",
    "tin",
    "blister",
    "theme_deck",
    "pre_release",
    "collector_box",
    "battle_deck",
    "world_championship",
    "plush",
    "miniature",
    "apparel",
    "trainer_kit",
    "empty_box",
    "playmat",
    "damage_counter",
    "sleeves",
    "deck_box",
    "pin",
    "coin",
    "binder_portfolio",
  ]).notNull(),
  language: varchar("language", { length: 32 }).default("English"),
  setId: varchar("setId", { length: 64 }),
  setName: varchar("setName", { length: 256 }),
  minPriceUsd: decimal("minPriceUsd", { precision: 10, scale: 2 }),
  avgPriceUsd: decimal("avgPriceUsd", { precision: 10, scale: 2 }),
  maxPriceUsd: decimal("maxPriceUsd", { precision: 10, scale: 2 }),
  viewCount: int("viewCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const productListings = mysqlTable("product_listings", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  sellerId: int("sellerId").notNull(),
  priceUsd: decimal("priceUsd", { precision: 10, scale: 2 }).notNull(),
  /** Listing price currency; priceUsd is retained as a legacy column name. */
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  quantity: int("quantity").default(1).notNull(),
  condition: mysqlEnum("condition", ["M", "NM", "SP", "MP", "HP", "D"])
    .default("NM")
    .notNull(),
  language: varchar("language", { length: 32 }).default("English"),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "sold", "cancelled"])
    .default("active")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductListing = typeof productListings.$inferSelect;

// ─── Seller Reviews ───────────────────────────────────────────────────────────

export const sellerReviews = mysqlTable("seller_reviews", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  orderId: int("orderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SellerReview = typeof sellerReviews.$inferSelect;

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    buyerId: int("buyerId").notNull(),
    sellerId: int("sellerId").notNull(),
    listingId: int("listingId"),
    productListingId: int("productListingId"),
    quantity: int("quantity").default(1).notNull(),
    totalUsd: decimal("totalUsd", { precision: 10, scale: 2 }).notNull(),
    /** Currency of totalUsd. New marketplace orders are BRL. */
    currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
    marketCountry: varchar("marketCountry", { length: 2 })
      .default("BR")
      .notNull(),
    status: mysqlEnum("status", [
      "pending",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
      "disputed",
    ])
      .default("pending")
      .notNull(),
    paymentStatus: mysqlEnum("paymentStatus", [
      "unpaid",
      "processing",
      "paid",
      "refunded",
    ])
      .default("unpaid")
      .notNull(),
    stripeSessionId: varchar("stripeSessionId", { length: 255 }),
    stripeChargeId: varchar("stripeChargeId", { length: 255 }),
    stripeSessionExpiresAt: timestamp("stripeSessionExpiresAt"),
    shippingName: varchar("shippingName", { length: 160 }),
    shippingPhone: varchar("shippingPhone", { length: 40 }),
    shippingAddress: json("shippingAddress"),
    buyerTermsVersion: varchar("buyerTermsVersion", { length: 32 }),
    buyerTermsAcceptedAt: timestamp("buyerTermsAcceptedAt"),
    cancellationReason: varchar("cancellationReason", { length: 255 }),
    /** Escrow: money held on platform until delivery is confirmed. */
    payoutStatus: mysqlEnum("payoutStatus", ["held", "released", "refunded"])
      .default("held")
      .notNull(),
    deliveredAt: timestamp("deliveredAt"),
    autoReleaseAt: timestamp("autoReleaseAt"),
    buyerProtection: boolean("buyerProtection").default(false).notNull(),
    trackingCarrier: varchar("trackingCarrier", { length: 32 }),
    trackingNumber: varchar("trackingNumber", { length: 256 }),
    shippedAt: timestamp("shippedAt"),
    disputeReason: varchar("disputeReason", { length: 64 }),
    disputeDetails: text("disputeDetails"),
    disputeOpenedAt: timestamp("disputeOpenedAt"),
    disputeResolution: varchar("disputeResolution", { length: 32 }),
    disputeResolvedAt: timestamp("disputeResolvedAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("orders_stripe_session_idx").on(table.stripeSessionId),
    index("orders_reservation_expiry_idx").on(
      table.status,
      table.paymentStatus,
      table.stripeSessionExpiresAt
    ),
    index("orders_fulfillment_queue_idx").on(
      table.status,
      table.paymentStatus,
      table.createdAt
    ),
  ]
);

export type Order = typeof orders.$inferSelect;

// ─── Marketplace audit trail ────────────────────────────────────────────────

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    actorUserId: int("actorUserId"),
    actorType: varchar("actorType", { length: 32 }).default("system").notNull(),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    fromStatus: varchar("fromStatus", { length: 32 }),
    toStatus: varchar("toStatus", { length: 32 }),
    note: text("note"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("order_events_order_created_idx").on(table.orderId, table.createdAt),
    index("order_events_type_created_idx").on(table.eventType, table.createdAt),
  ]
);

export type OrderEvent = typeof orderEvents.$inferSelect;

// ─── Trust & safety reports ─────────────────────────────────────────────────

export const marketplaceReports = mysqlTable(
  "marketplace_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    reporterId: int("reporterId").notNull(),
    sellerId: int("sellerId"),
    targetType: mysqlEnum("targetType", [
      "store",
      "card_listing",
      "product_listing",
      "order",
    ]).notNull(),
    targetId: int("targetId").notNull(),
    reason: mysqlEnum("reason", [
      "suspected_counterfeit",
      "misleading_listing",
      "prohibited_item",
      "harassment",
      "other",
    ]).notNull(),
    details: text("details").notNull(),
    status: mysqlEnum("status", ["open", "reviewing", "resolved", "dismissed"])
      .default("open")
      .notNull(),
    adminNote: text("adminNote"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("marketplace_reports_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    index("marketplace_reports_seller_created_idx").on(
      table.sellerId,
      table.createdAt
    ),
  ]
);

export type MarketplaceReport = typeof marketplaceReports.$inferSelect;

// ─── Stripe webhook idempotency ──────────────────────────────────────────────

export const webhookEvents = mysqlTable("webhook_events", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 128 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;

// ─── Seller payout ledger ────────────────────────────────────────────────────

export const payouts = mysqlTable("payouts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  sellerId: int("sellerId").notNull(),
  amountCents: int("amountCents").notNull(),
  stripeTransferId: varchar("stripeTransferId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "sent", "failed", "reversed"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payout = typeof payouts.$inferSelect;

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  listingId: int("listingId"),
  productListingId: int("productListingId"),
  quantity: int("quantity").default(1).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "auction_bid",
    "auction_won",
    "order_update",
    "price_alert",
    "drop_alert",
    "bazaar_match",
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Drop Alerts ──────────────────────────────────────────────────────────────

export const dropAlerts = mysqlTable("drop_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productName: varchar("productName", { length: 512 }).notNull(),
  retailer: mysqlEnum("retailer", [
    "pokemon_center",
    "amazon",
    "target",
  ]).notNull(),
  productUrl: text("productUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  pushSubscription: json("pushSubscription"),
  lastChecked: timestamp("lastChecked"),
  lastTriggered: timestamp("lastTriggered"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DropAlert = typeof dropAlerts.$inferSelect;
export type InsertDropAlert = typeof dropAlerts.$inferInsert;

// ─── Price Cache ──────────────────────────────────────────────────────────────

export const priceCache = mysqlTable("price_cache", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull().unique(),
  tcgLow: decimal("tcgLow", { precision: 10, scale: 2 }),
  tcgMid: decimal("tcgMid", { precision: 10, scale: 2 }),
  tcgHigh: decimal("tcgHigh", { precision: 10, scale: 2 }),
  tcgMarket: decimal("tcgMarket", { precision: 10, scale: 2 }),
  tcgDirectLow: decimal("tcgDirectLow", { precision: 10, scale: 2 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceCache = typeof priceCache.$inferSelect;

// ─── External API response cache ────────────────────────────────────────────

/**
 * Last-known-good responses from catalog providers. Unlike the in-process
 * cache, these rows survive Railway restarts and short upstream outages.
 */
export const externalApiCache = mysqlTable(
  "external_api_cache",
  {
    cacheKey: varchar("cacheKey", { length: 64 }).primaryKey(),
    provider: varchar("provider", { length: 48 }).notNull(),
    payload: json("payload").notNull(),
    freshUntil: timestamp("freshUntil").notNull(),
    staleUntil: timestamp("staleUntil").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("external_api_cache_stale_idx").on(table.staleUntil)]
);

export type ExternalApiCache = typeof externalApiCache.$inferSelect;

// ─── Price History ────────────────────────────────────────────────────────────

export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  tcgMarket: decimal("tcgMarket", { precision: 10, scale: 2 }),
  tcgLow: decimal("tcgLow", { precision: 10, scale: 2 }),
  tcgHigh: decimal("tcgHigh", { precision: 10, scale: 2 }),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;

// ─── Collector Market Pulse ──────────────────────────────────────────────────

/**
 * First-party demand signals. These rows describe activity on TCG Arena only;
 * they must never be presented as global Pokémon TCG search volume.
 */
export const marketEvents = mysqlTable(
  "market_events",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }).notNull(),
    userId: int("userId"),
    eventType: mysqlEnum("eventType", [
      "search",
      "card_view",
      "watchlist_add",
      "watchlist_remove",
    ]).notNull(),
    cardId: varchar("cardId", { length: 64 }),
    cardName: varchar("cardName", { length: 256 }),
    setId: varchar("setId", { length: 64 }),
    setName: varchar("setName", { length: 256 }),
    imageUrl: text("imageUrl"),
    query: varchar("query", { length: 128 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("market_events_type_created_idx").on(
      table.eventType,
      table.createdAt
    ),
    index("market_events_card_created_idx").on(table.cardId, table.createdAt),
    index("market_events_session_type_created_idx").on(
      table.sessionId,
      table.eventType,
      table.createdAt
    ),
  ]
);

export type MarketEvent = typeof marketEvents.$inferSelect;
export type InsertMarketEvent = typeof marketEvents.$inferInsert;

/** Daily/on-update market observations from explicitly named data sources. */
export const marketPriceSnapshots = mysqlTable(
  "market_price_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    cardId: varchar("cardId", { length: 64 }).notNull(),
    cardName: varchar("cardName", { length: 256 }).notNull(),
    setId: varchar("setId", { length: 64 }),
    setName: varchar("setName", { length: 256 }),
    imageUrl: text("imageUrl"),
    source: varchar("source", { length: 64 }).notNull(),
    variant: varchar("variant", { length: 64 }).default("market").notNull(),
    condition: varchar("condition", { length: 16 }).default("NM").notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    marketPriceUsd: decimal("marketPriceUsd", {
      precision: 12,
      scale: 2,
    }).notNull(),
    lowPriceUsd: decimal("lowPriceUsd", { precision: 12, scale: 2 }),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  table => [
    index("market_snapshots_card_recorded_idx").on(
      table.cardId,
      table.recordedAt
    ),
    index("market_snapshots_recorded_idx").on(table.recordedAt),
  ]
);

export type MarketPriceSnapshot = typeof marketPriceSnapshots.$inferSelect;
export type InsertMarketPriceSnapshot =
  typeof marketPriceSnapshots.$inferInsert;

/** User watchlist and optional buy-price alert for a single card. */
export const marketWatchlist = mysqlTable(
  "market_watchlist",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    cardId: varchar("cardId", { length: 64 }).notNull(),
    cardName: varchar("cardName", { length: 256 }).notNull(),
    setId: varchar("setId", { length: 64 }),
    setName: varchar("setName", { length: 256 }),
    imageUrl: text("imageUrl"),
    targetPriceUsd: decimal("targetPriceUsd", { precision: 12, scale: 2 }),
    isActive: boolean("isActive").default(true).notNull(),
    lastNotifiedAt: timestamp("lastNotifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("market_watchlist_user_card_unique").on(
      table.userId,
      table.cardId
    ),
    index("market_watchlist_card_active_idx").on(table.cardId, table.isActive),
  ]
);

export type MarketWatch = typeof marketWatchlist.$inferSelect;
export type InsertMarketWatch = typeof marketWatchlist.$inferInsert;

// ─── Banner Slides ────────────────────────────────────────────────────────────

export const bannerSlides = mysqlTable("banner_slides", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }),
  subtitle: text("subtitle"),
  imageUrl: text("imageUrl").notNull(),
  linkUrl: text("linkUrl"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BannerSlide = typeof bannerSlides.$inferSelect;

// ─── Guess Game ───────────────────────────────────────────────────────────────

export const gameRounds = mysqlTable("game_rounds", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetId: int("targetId").notNull(),
  attemptsUsed: int("attemptsUsed").default(0).notNull(),
  status: mysqlEnum("status", ["active", "won", "lost"])
    .default("active")
    .notNull(),
  roundScore: int("roundScore").default(0).notNull(),
  guesses: json("guesses"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});

export type GameRound = typeof gameRounds.$inferSelect;

export const gameStats = mysqlTable("game_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalPoints: int("totalPoints").default(0).notNull(),
  wins: int("wins").default(0).notNull(),
  losses: int("losses").default(0).notNull(),
  streak: int("streak").default(0).notNull(),
  bestAttempts: int("bestAttempts"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameStats = typeof gameStats.$inferSelect;

export const gameWeeklyScores = mysqlTable(
  "game_weekly_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    weekKey: varchar("weekKey", { length: 10 }).notNull(),
    points: int("points").default(0).notNull(),
    wins: int("wins").default(0).notNull(),
    hardWins: int("hardWins").default(0).notNull(),
    scoredRounds: int("scoredRounds").default(0).notNull(),
    lastScoredAt: timestamp("lastScoredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("game_weekly_scores_user_week_unique").on(
      table.userId,
      table.weekKey
    ),
    index("game_weekly_scores_rank_idx").on(
      table.weekKey,
      table.points,
      table.hardWins,
      table.lastScoredAt
    ),
  ]
);

export type GameWeeklyScore = typeof gameWeeklyScores.$inferSelect;

export const gameWeeklyCompetitions = mysqlTable(
  "game_weekly_competitions",
  {
    id: int("id").autoincrement().primaryKey(),
    weekKey: varchar("weekKey", { length: 10 }).notNull().unique(),
    prizeTitle: varchar("prizeTitle", { length: 160 }).notNull(),
    prizeDescription: text("prizeDescription"),
    prizeImageUrl: text("prizeImageUrl"),
    rulesUrl: text("rulesUrl").notNull(),
    authorizationReference: varchar("authorizationReference", {
      length: 160,
    }).notNull(),
    eligibleCountry: varchar("eligibleCountry", { length: 2 })
      .default("BR")
      .notNull(),
    status: mysqlEnum("status", [
      "draft",
      "active",
      "closed",
      "fulfilled",
      "cancelled",
    ])
      .default("draft")
      .notNull(),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    winnerUserId: int("winnerUserId"),
    finalizedAt: timestamp("finalizedAt"),
    claimDeadline: timestamp("claimDeadline"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("game_weekly_competitions_status_end_idx").on(
      table.status,
      table.endsAt
    ),
  ]
);

export type GameWeeklyCompetition = typeof gameWeeklyCompetitions.$inferSelect;

export const gamePrizeClaims = mysqlTable(
  "game_prize_claims",
  {
    id: int("id").autoincrement().primaryKey(),
    competitionId: int("competitionId").notNull().unique(),
    userId: int("userId").notNull(),
    fullName: varchar("fullName", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    postalCode: varchar("postalCode", { length: 16 }).notNull(),
    addressLine1: varchar("addressLine1", { length: 200 }).notNull(),
    addressNumber: varchar("addressNumber", { length: 32 }).notNull(),
    addressLine2: varchar("addressLine2", { length: 160 }),
    neighborhood: varchar("neighborhood", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    country: varchar("country", { length: 2 }).default("BR").notNull(),
    status: mysqlEnum("status", ["submitted", "shipped", "delivered"])
      .default("submitted")
      .notNull(),
    trackingCode: varchar("trackingCode", { length: 120 }),
    claimedAt: timestamp("claimedAt").defaultNow().notNull(),
    shippedAt: timestamp("shippedAt"),
    deliveredAt: timestamp("deliveredAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("game_prize_claims_status_idx").on(table.status, table.claimedAt),
  ]
);

export type GamePrizeClaim = typeof gamePrizeClaims.$inferSelect;

// ─── Seller Stores ────────────────────────────────────────────────────────────

export const sellerStores = mysqlTable("seller_stores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  storeName: varchar("storeName", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  tagline: varchar("tagline", { length: 256 }),
  description: text("description"),
  logoUrl: text("logoUrl"),
  bannerUrl: text("bannerUrl"),
  location: varchar("location", { length: 128 }),
  /** Current marketplace checkout method: ["card"]. */
  paymentMethods: json("paymentMethods"),
  country: varchar("country", { length: 2 }).default("BR").notNull(),
  businessType: varchar("businessType", { length: 32 })
    .default("individual")
    .notNull(),
  /** Stripe Connect account used after escrow release. */
  stripeAccountId: varchar("stripeAccountId", { length: 255 }),
  stripePayoutsEnabled: boolean("stripePayoutsEnabled")
    .default(false)
    .notNull(),
  stripeChargesEnabled: boolean("stripeChargesEnabled")
    .default(false)
    .notNull(),
  shipsFrom: varchar("shipsFrom", { length: 128 }),
  handlingDays: int("handlingDays").default(2).notNull(),
  shippingPolicy: text("shippingPolicy"),
  returnPolicy: text("returnPolicy"),
  sellerTermsVersion: varchar("sellerTermsVersion", { length: 32 }),
  sellerTermsAcceptedAt: timestamp("sellerTermsAcceptedAt"),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SellerStore = typeof sellerStores.$inferSelect;
export type InsertSellerStore = typeof sellerStores.$inferInsert;
