import { TRPCError } from "@trpc/server";
import { cached, TTL } from "./lib/cache.js";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getCMCardByTcgId, getCMPriceHistory, searchCMCardsGrid } from "./cardmarketApi.js";
import {
  addBinderCard,
  createAlert,
  createAuction,
  createDeck,
  createListing,
  deleteAlert,
  deleteDeck,
  getActiveAuctions,
  getAuctionBids,
  getAuctionById,
  getBinderCards,
  getComments,
  addComment,
  getDeckById,
  getDeckCards,
  getListingsByCard,
  getPublicDecks,
  getPublishedArticles,
  getArticleBySlug,
  getUserAlerts,
  getUserByOpenId,
  getUserByUsername,
  getUserDecks,
  getUserListings,
  placeBid,
  removeBinderCard,
  updateAlert,
  updateBinderCard,
  updateDeck,
  updateUserProfile,
  upsertDeckCards,
  upsertPriceCache,
} from "./db";
import {
  getCardById,
  getCardMarketUrl,
  getCardsByIds,
  getEbayUrl,
  getHighValueCards,
  getPriceFromCard,
  getSets,
  getTcgPlayerUrl,
  isSpecialRare,
  searchCards,
  GRID_SELECT,
} from "./lib/pokemontcg";
import {
  countryFlag,
  getCompletedTournaments,
  getMetaDecks,
  getUpcomingTournaments,
} from "./lib/limitless";
import { getPokedexTypeCounts, queryPokedex } from "./lib/pokedex";
import {
  evaluateGuess,
  getDexEntry,
  pickRandomTarget,
  MAX_ATTEMPTS,
  POINTS_PER_ATTEMPT,
  REGION_BY_GEN,
  type GuessFeedback,
} from "./lib/guessGame";
import {
  createRound,
  getActiveRound,
  getLeaderboard,
  getStats,
  recordResult,
  saveRoundProgress,
} from "./gameDb";
import { toggleAuctionWatch, getUserWatchedAuctionIds } from "./db";
import { createNotification, getListingsByCardWithSeller } from "./marketplaceDb";
import {
  bazaarRouter,
  cartRouter,
  listingsRouter as marketplaceListingsRouter,
  notificationsRouter,
  ordersRouter,
  productsRouter,
} from "./marketplaceRouter";

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Cards ─────────────────────────────────────────────────────────────────
  cards: router({
    search: publicProcedure
      .input(z.object({
        q: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(48).default(24),
        set: z.string().optional(),
        type: z.string().optional(),
        rarity: z.string().optional(),
        supertype: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const buildFilters = () => {
          const parts: string[] = [];
          if (input.set) parts.push(`set.id:${input.set}`);
          if (input.type) parts.push(`types:${input.type}`);
          if (input.rarity) parts.push(`rarity:"${input.rarity}"`);
          if (input.supertype) parts.push(`supertype:${input.supertype}`);
          return parts;
        };
        const run = (extra: string[]) => {
          const q = [...extra, ...buildFilters()].join(" ");
          return searchCards({ q: q || undefined, page: input.page, pageSize: input.pageSize, orderBy: "-set.releaseDate", select: GRID_SELECT });
        };

        const raw = (input.q ?? "").trim();
        // Strip leading zeros from a collector number, keeping letter suffixes ("025" → "25", "012a" → "12a")
        const cleanNum = (n: string) => n.replace(/^0+(?=\d)/, "");

        // ── Card-code detection (before hitting any API) ──
        const idMatch = raw.match(/^([a-z0-9.]+)-(\d+[a-zA-Z]*|[A-Z]+\d+)$/i);          // "sv7-45"
        const numMatch = raw.match(/^(\d{1,3}[a-zA-Z]?)\s*\/\s*(\d{1,3})$/);          // "25/102", "025/086"
        const setCodeMatch = raw.match(/^([a-zA-Z]{2,6})[\s-]+(\d{1,3}[a-zA-Z]?)$/);     // "PAL 123"

        let codeQuery: string[] | null = null;
        if (idMatch) codeQuery = [`id:${raw.toLowerCase()}`];
        else if (numMatch) codeQuery = [`number:${cleanNum(numMatch[1])}`, `set.printedTotal:${parseInt(numMatch[2], 10)}`];
        else if (setCodeMatch) codeQuery = [`set.ptcgoCode:${setCodeMatch[1].toUpperCase()}`, `number:${cleanNum(setCodeMatch[2])}`];

        // "25/102" and "sv7-45" formats only exist on pokemontcg.io — skip RapidAPI for those
        const rapidQuery = numMatch
          ? null
          : setCodeMatch
            ? `${setCodeMatch[1].toUpperCase()} ${cleanNum(setCodeMatch[2])}` // matches card_code_number "PAL 123"
            : idMatch ? null : raw;

        // ── Primary: RapidAPI (CardMarket API TCG). Falls back on quota/error/empty ──
        const hasFilters = !!(input.set || input.type || input.rarity || input.supertype);
        if (rapidQuery && !hasFilters) {
          try {
            const rapid = await searchCMCardsGrid(rapidQuery, input.page, input.pageSize);
            if (rapid && rapid.count > 0) return rapid;
          } catch {
            // fall through to pokemontcg.io
          }
        }

        // ── Fallback: pokemontcg.io — code + name in parallel; code wins when it has results ──
        if (codeQuery) {
          const [byCode, byName] = await Promise.allSettled([run(codeQuery), run([`name:"${raw}*"`])]);
          if (byCode.status === "fulfilled" && byCode.value.totalCount > 0) return byCode.value;
          if (byName.status === "fulfilled") return byName.value;
          if (byCode.status === "fulfilled") return byCode.value;
          throw byName.reason;
        }

        return run(raw ? [`name:"${raw}*"`] : []);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const card = await getCardById(input.id);
        if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
        const price = getPriceFromCard(card);
        return {
          ...card,
          isSpecialRare: isSpecialRare(card.rarity),
          bestPrice: price,
          links: {
            tcgplayer: card.tcgplayer?.url ?? getTcgPlayerUrl(card.name, card.set.name),
            ebay: getEbayUrl(card.name, card.set.name),
            cardmarket: card.cardmarket?.url ?? getCardMarketUrl(card.name),
          },
        };
      }),

    getHighValue: publicProcedure
      .input(z.object({ page: z.number().int().min(1).default(1) }))
      .query(async ({ input }) => getHighValueCards(input.page)),

    getExternalPrices: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const prices = await getCMCardByTcgId(input.id);
        if (!prices) return null;
        // Also fetch history if we have a CM card ID
        const history = prices.cardId
          ? await getCMPriceHistory(prices.cardId, 90)
          : [];
        return { prices, history };
      }),

    batchPrices: publicProcedure
      .input(z.object({ cardIds: z.array(z.string()).max(50) }))
      .query(async ({ input }) => {
        const cards = await getCardsByIds(input.cardIds);
        const result: Record<string, { low?: number; mid?: number; high?: number; market?: number }> = {};
        for (const card of cards) {
          const price = getPriceFromCard(card);
          if (price) {
            result[card.id] = {
              low: price.low,
              mid: price.mid,
              high: price.high,
              market: price.market,
            };
            // Cache to DB
            upsertPriceCache(card.id, {
              tcgLow: price.low,
              tcgMid: price.mid,
              tcgHigh: price.high,
              tcgMarket: price.market,
              tcgDirectLow: price.directLow,
            }).catch(() => {});
          }
        }
        return result;
      }),
  }),

  // ─── Sets ──────────────────────────────────────────────────────────────────
  sets: router({
    list: publicProcedure.query(async () => {
      const sets = await getSets();
      // Group by series
      const grouped: Record<string, typeof sets> = {};
      for (const s of sets) {
        if (!grouped[s.series]) grouped[s.series] = [];
        grouped[s.series].push(s);
      }
      return { sets, grouped };
    }),
    recent: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }))
      .query(async ({ input }) => {
        return cached(`sets:recent:${input.limit}`, TTL.ONE_HOUR, async () => {
          const sets = await getSets();
          // Already sorted by -releaseDate from the API
          const recent = sets.slice(0, input.limit);
          // Fetch a featured card (Special Illustration Rare or Hyper Rare) for each set
          const withCards = await Promise.all(
            recent.map(async (set) => {
              try {
                const rare = await searchCards({
                  q: `set.id:${set.id} (rarity:"Special Illustration Rare" OR rarity:"Hyper Rare" OR rarity:"Ultra Rare")`,
                  pageSize: 4,
                  orderBy: "-set.releaseDate",
                });
                const featuredCards = rare.data.slice(0, 4).map((c) => ({
                  id: c.id,
                  name: c.name,
                  image: c.images.large ?? c.images.small,
                  rarity: c.rarity ?? "",
                }));
                return { ...set, featuredCards };
              } catch {
                return { ...set, featuredCards: [] };
              }
            })
          );
          return withCards;
        }); // end cached
      }),
  }),

  // ─── Metagame ──────────────────────────────────────────────────────────────
  metagame: router({
    topDecks: publicProcedure
      .input(z.object({ format: z.string().default("TEF-CRI") }))
      .query(async ({ input }) => getMetaDecks(input.format)),
  }),

  // ─── Tournaments ───────────────────────────────────────────────────────────
  tournaments: router({
    completed: publicProcedure.query(async () => {
      const tournaments = await getCompletedTournaments();
      return tournaments.map((t) => ({
        ...t,
        countryFlag: countryFlag(t.country),
        winnerFlag: t.winnerCountry ? countryFlag(t.winnerCountry) : "",
      }));
    }),
    upcoming: publicProcedure.query(async () => getUpcomingTournaments()),
  }),

  // ─── Binder ────────────────────────────────────────────────────────────────
  binder: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getBinderCards(user.id);
    }),

    add: protectedProcedure
      .input(z.object({
        cardId: z.string(),
        cardName: z.string(),
        setName: z.string().optional(),
        setId: z.string().optional(),
        imageUrl: z.string().optional(),
        rarity: z.string().optional(),
        quantity: z.number().int().min(1).max(99).default(1),
        condition: z.enum(["M", "NM", "SP", "MP", "HP", "D"]).default("NM"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await addBinderCard({ ...input, userId: user.id });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        quantity: z.number().int().min(1).max(99).optional(),
        condition: z.enum(["M", "NM", "SP", "MP", "HP", "D"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const { id, ...data } = input;
        await updateBinderCard(id, user.id, data);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await removeBinderCard(input.id, user.id);
        return { success: true };
      }),
  }),

  // ─── Decks ─────────────────────────────────────────────────────────────────
  decks: router({
    myDecks: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getUserDecks(user.id);
    }),

    publicDecks: publicProcedure.query(async () => getPublicDecks(20)),

    getById: publicProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const deck = await getDeckById(input.id);
        if (!deck) throw new TRPCError({ code: "NOT_FOUND" });
        const cards = await getDeckCards(deck.id);
        return { ...deck, cards };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(256),
        description: z.string().optional(),
        format: z.enum(["standard", "expanded", "unlimited"]).default("standard"),
        isPublic: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await createDeck({ ...input, userId: user.id, cardCount: 0 });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        name: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        format: z.enum(["standard", "expanded", "unlimited"]).optional(),
        isPublic: z.boolean().optional(),
        estimatedCostUsd: z.string().optional(),
        cardCount: z.number().int().optional(),
        cards: z.array(z.object({
          cardId: z.string(),
          cardName: z.string(),
          setName: z.string().optional(),
          setId: z.string().optional(),
          imageUrl: z.string().optional(),
          supertype: z.string().optional(),
          quantity: z.number().int().min(1).max(4),
          priceUsd: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const { id, cards, ...deckData } = input;
        await updateDeck(id, user.id, deckData);
        if (cards !== undefined) {
          await upsertDeckCards(id, cards.map((c) => ({ ...c, deckId: id })));
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await deleteDeck(input.id, user.id);
        return { success: true };
      }),
  }),

  // ─── Drop Alerts ───────────────────────────────────────────────────────────
  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getUserAlerts(user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        productName: z.string().min(1).max(512),
        retailer: z.enum(["pokemon_center", "amazon", "target"]),
        productUrl: z.string().url().optional(),
        pushSubscription: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await createAlert({ ...input, userId: user.id });
        return { success: true };
      }),

    toggle: protectedProcedure
      .input(z.object({ id: z.number().int(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await updateAlert(input.id, user.id, { isActive: input.isActive });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await deleteAlert(input.id, user.id);
        return { success: true };
      }),
  }),

  // ─── Player Profile ────────────────────────────────────────────────────────
  players: router({
    getProfile: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input }) => {
        const user = await getUserByUsername(input.username);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        const publicDecks = await getPublicDecks(50);
        const userDecks = publicDecks.filter((d) => d.userId === user.id);
        return {
          id: user.id,
          username: user.username,
          name: user.name,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          publicDecks: userDecks,
        };
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
        bio: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (input.username) {
          const existing = await getUserByUsername(input.username);
          if (existing && existing.id !== user.id) {
            throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
          }
        }
        await updateUserProfile(user.id, input);
        return { success: true };
      }),
  }),

  // ─── Pokémon ───────────────────────────────────────────────────────────────
  // ─── Auctions ────────────────────────────────────────────────────────────────
  auctions: router({
    list: publicProcedure
      .input(z.object({
        conditions: z.array(z.enum(["M", "NM", "SP", "MP", "HP", "D"])).optional(),
        language: z.string().optional(),
        foilOnly: z.boolean().optional(),
        promoOnly: z.boolean().optional(),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().positive().optional(),
        sort: z.enum(["ending_soon", "bids", "price_asc", "price_desc", "newest"]).optional(),
        limit: z.number().int().min(1).max(120).optional(),
      }).optional())
      .query(async ({ input }) => {
        const rows = await getActiveAuctions(input ?? {});
        return rows.map((a) => ({
          ...a,
          currentBidUsd: a.currentBidUsd ? parseFloat(String(a.currentBidUsd)) : null,
          startingBidUsd: a.startingBidUsd ? parseFloat(String(a.startingBidUsd)) : null,
          fixedPriceUsd: a.fixedPriceUsd ? parseFloat(String(a.fixedPriceUsd)) : null,
          endsAt: a.endsAt.toISOString(),
          createdAt: a.createdAt.toISOString(),
        }));
      }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(3).max(512),
        cardId: z.string().optional(),
        cardName: z.string().optional(),
        setId: z.string().optional(),
        setName: z.string().optional(),
        imageUrl: z.string().url().optional(),
        condition: z.enum(["M", "NM", "SP", "MP", "HP", "D"]).default("NM"),
        language: z.string().max(32).default("English"),
        isFoil: z.boolean().default(false),
        isPromo: z.boolean().default(false),
        startingBidUsd: z.number().positive(),
        fixedPriceUsd: z.number().positive().optional(),
        durationHours: z.number().int().min(1).max(24 * 14).default(72),
      }))
      .mutation(async ({ input, ctx }) => {
        const { durationHours, startingBidUsd, fixedPriceUsd, ...rest } = input;
        await createAuction({
          ...rest,
          sellerId: ctx.user.id,
          startingBidUsd: startingBidUsd.toFixed(2),
          fixedPriceUsd: fixedPriceUsd?.toFixed(2),
          endsAt: new Date(Date.now() + durationHours * 3600_000),
          status: "active",
        });
        return { success: true };
      }),
    toggleWatch: protectedProcedure
      .input(z.object({ auctionId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => toggleAuctionWatch(input.auctionId, ctx.user.id)),
    myWatched: protectedProcedure.query(({ ctx }) => getUserWatchedAuctionIds(ctx.user.id)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: "NOT_FOUND", message: "Auction not found" });
        const bids = await getAuctionBids(input.id);
        return {
          ...auction,
          currentBidUsd: auction.currentBidUsd ? parseFloat(String(auction.currentBidUsd)) : null,
          startingBidUsd: auction.startingBidUsd ? parseFloat(String(auction.startingBidUsd)) : null,
          fixedPriceUsd: auction.fixedPriceUsd ? parseFloat(String(auction.fixedPriceUsd)) : null,
          endsAt: auction.endsAt.toISOString(),
          createdAt: auction.createdAt.toISOString(),
          bids: bids.map((b) => ({
            ...b,
            amountUsd: parseFloat(String(b.amountUsd)),
            createdAt: b.createdAt.toISOString(),
          })),
        };
      }),
    placeBid: protectedProcedure
      .input(z.object({ auctionId: z.number(), amountUsd: z.number().positive() }))
      .mutation(async ({ input, ctx }) => {
        // Validation happens inside the transaction (row-locked) in placeBid.
        let result: { previousTopBidderId: number | null; newBid: number };
        try {
          result = await placeBid(input.auctionId, ctx.user.id, input.amountUsd);
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Failed to place bid",
          });
        }
        // Outbid notification (best-effort, outside the transaction)
        if (result.previousTopBidderId && result.previousTopBidderId !== ctx.user.id) {
          await createNotification({
            userId: result.previousTopBidderId,
            type: "auction_bid",
            title: "You've been outbid!",
            message: `Someone bid $${input.amountUsd.toFixed(2)} on an auction you were winning.`,
            entityType: "auction",
            entityId: String(input.auctionId),
          }).catch(() => {});
        }
        return { success: true, newBid: input.amountUsd };
      }),
    getBids: publicProcedure
      .input(z.object({ auctionId: z.number() }))
      .query(async ({ input }) => {
        const bids = await getAuctionBids(input.auctionId);
        return bids.map((b) => ({
          ...b,
          amountUsd: parseFloat(String(b.amountUsd)),
          createdAt: b.createdAt.toISOString(),
        }));
      }),
  }),

  // ─── Articles ────────────────────────────────────────────────────────────────
  articles: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const cacheKey = `articles:list:${input.limit}:${input.category ?? "all"}`;
        return cached(cacheKey, TTL.FIVE_MIN, async () => {
          const rows = await getPublishedArticles(input.limit, input.category);
          return rows.map((a) => ({
            ...a,
            tags: Array.isArray(a.tags) ? a.tags : [],
            publishedAt: a.publishedAt?.toISOString() ?? null,
            createdAt: a.createdAt.toISOString(),
          }));
        });
      }),
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const article = await getArticleBySlug(input.slug);
        if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
        const articleComments = await getComments("article", String(article.id));
        return {
          ...article,
          tags: Array.isArray(article.tags) ? article.tags : [],
          publishedAt: article.publishedAt?.toISOString() ?? null,
          createdAt: article.createdAt.toISOString(),
          comments: articleComments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          })),
        };
      }),
    addComment: protectedProcedure
      .input(z.object({ articleId: z.number(), content: z.string().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        await addComment({
          userId: ctx.user.id,
          entityType: "article",
          entityId: String(input.articleId),
          content: input.content,
        });
        return { success: true };
      }),
  }),

  // ─── Marketplace ─────────────────────────────────────────────────────────────
  products: productsRouter,
  cart: cartRouter,
  orders: ordersRouter,
  notifications: notificationsRouter,
  bazaar: bazaarRouter,
  marketplaceListings: marketplaceListingsRouter,

  // ─── Listings (Sell a Card) ────────────────────────────────────────────────────
  listings: router({
    getByCard: publicProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        const rows = await getListingsByCard(input.cardId);
        return rows.map((l) => ({
          ...l,
          priceUsd: l.priceUsd ? parseFloat(String(l.priceUsd)) : null,
          createdAt: l.createdAt.toISOString(),
        }));
      }),
    /** Active listings for a card WITH seller info — powers the seller table on Card Detail. */
    getByCardWithSellers: publicProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        const rows = await getListingsByCardWithSeller(input.cardId);
        return rows.map((r) => ({
          id: r.listing.id,
          cardId: r.listing.cardId,
          cardName: r.listing.cardName,
          condition: r.listing.condition,
          language: r.listing.language,
          isFoil: r.listing.isFoil,
          isFirstEdition: r.listing.isFirstEdition,
          quantity: r.listing.quantity,
          priceUsd: parseFloat(String(r.listing.priceUsd)),
          notes: r.listing.notes,
          createdAt: r.listing.createdAt.toISOString(),
          seller: {
            name: r.sellerName,
            username: r.sellerUsername,
            avatarUrl: r.sellerAvatarUrl,
            location: r.sellerLocation,
            rating: r.sellerRating ? parseFloat(String(r.sellerRating)) : 0,
            totalSales: r.sellerTotalSales ?? 0,
            isVerified: r.sellerIsVerified ?? false,
            hasPhysicalStore: r.sellerHasPhysicalStore ?? false,
          },
        }));
      }),
    myListings: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getUserListings(ctx.user.id);
      return rows.map((l) => ({
        ...l,
        priceUsd: l.priceUsd ? parseFloat(String(l.priceUsd)) : null,
        createdAt: l.createdAt.toISOString(),
      }));
    }),
    create: protectedProcedure
      .input(z.object({
        cardId: z.string(),
        cardName: z.string(),
        setId: z.string().optional(),
        setName: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number().int().min(1).max(99).default(1),
        condition: z.enum(["M", "NM", "SP", "MP", "HP", "D"]),
        language: z.string().default("English"),
        priceUsd: z.number().positive(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await createListing({
          sellerId: ctx.user.id,
          cardId: input.cardId,
          cardName: input.cardName,
          setId: input.setId,
          setName: input.setName,
          imageUrl: input.imageUrl,
          quantity: input.quantity,
          condition: input.condition,
          language: input.language,
          priceUsd: input.priceUsd.toFixed(2),
          notes: input.notes,
          status: "active",
        });
        return { success: true };
      }),
  }),


  // ─── Guess the Pokémon (game) ──────────────────────────────────────────────
  game: router({
    /** Start a new round (abandons any active one). Target stays server-side. */
    start: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const targetId = await pickRandomTarget();
      const round = await createRound(user.id, targetId);
      if (!round) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not start game" });
      return {
        roundId: round.id,
        attemptsRemaining: MAX_ATTEMPTS,
        maxAttempts: MAX_ATTEMPTS,
        guesses: [] as GuessFeedback[],
        status: "active" as const,
      };
    }),

    /** Resume the active round after a refresh (never reveals the target). */
    current: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const round = await getActiveRound(user.id);
      if (!round) return null;
      const guesses = (round.guesses as GuessFeedback[] | null) ?? [];
      return {
        roundId: round.id,
        attemptsRemaining: MAX_ATTEMPTS - round.attemptsUsed,
        maxAttempts: MAX_ATTEMPTS,
        guesses,
        status: round.status,
      };
    }),

    /** Submit a guess — graded server-side against the hidden target. */
    guess: protectedProcedure
      .input(z.object({ roundId: z.number().int(), pokemonId: z.number().int().min(1).max(1025) }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const round = await getActiveRound(user.id);
        if (!round || round.id !== input.roundId || round.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active round — start a new game." });
        }

        const prev = (round.guesses as GuessFeedback[] | null) ?? [];
        if (prev.some((g) => g.guess.id === input.pokemonId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You already tried that Pokémon." });
        }

        const attempt = round.attemptsUsed + 1;
        const feedback = await evaluateGuess(input.pokemonId, round.targetId, attempt);
        const guesses = [feedback, ...prev];

        const won = feedback.tier === "win";
        const outOfAttempts = !won && attempt >= MAX_ATTEMPTS;
        const roundScore = won ? (MAX_ATTEMPTS - attempt) * POINTS_PER_ATTEMPT + POINTS_PER_ATTEMPT : 0;

        await saveRoundProgress(round.id, {
          attemptsUsed: attempt,
          guesses,
          status: won ? "won" : outOfAttempts ? "lost" : "active",
          roundScore,
        });

        let reveal: { id: number; name: string; sprite: string; types: string[]; generation: number; region: string } | null = null;
        if (won || outOfAttempts) {
          await recordResult(user.id, won, roundScore, attempt);
          const t = await getDexEntry(round.targetId);
          if (t) {
            reveal = {
              id: t.id,
              name: t.name.charAt(0).toUpperCase() + t.name.slice(1),
              sprite: t.sprite,
              types: t.types,
              generation: t.generation,
              region: REGION_BY_GEN[t.generation] ?? "Unknown",
            };
          }
        }

        return {
          feedback,
          guesses,
          attemptsRemaining: MAX_ATTEMPTS - attempt,
          status: won ? ("won" as const) : outOfAttempts ? ("lost" as const) : ("active" as const),
          roundScore,
          reveal,
        };
      }),

    myStats: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserByOpenId(ctx.user.openId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getStats(user.id);
    }),

    leaderboard: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).default({ limit: 20 }))
      .query(({ input }) => getLeaderboard(input.limit)),
  }),

  pokemon: router({
    /** Full National Dex (1025 Pokémon) with text/type/generation filters. */
    list: publicProcedure
      .input(z.object({
        q: z.string().optional(),
        type: z.string().optional(),
        generation: z.number().int().min(1).max(9).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(120).default(48),
      }).default({ page: 1, pageSize: 48 }))
      .query(({ input }) => queryPokedex(input)),

    typeCounts: publicProcedure.query(() => getPokedexTypeCounts()),

    getDetail: publicProcedure
      .input(z.object({ id: z.union([z.string(), z.number()]) }))
      .query(async ({ input }) => {
        const idOrName = String(input.id).toLowerCase();
        return cached(`pokemon:detail:${idOrName}`, TTL.ONE_DAY, async () => {
        // Fetch base Pokémon data
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
        if (!res.ok) throw new TRPCError({ code: "NOT_FOUND", message: "Pokémon not found" });
        const data = await res.json() as PokeApiPokemon;

        // Fetch species for evolution chain URL, flavor text, genera
        const speciesRes = await fetch(data.species.url);
        const species = await speciesRes.json() as PokeApiSpecies;

        // Fetch evolution chain
        const evoRes = await fetch(species.evolution_chain.url);
        const evoData = await evoRes.json() as { chain: PokeApiEvoChain };

        // Recursively collect all evolution branches
        function collectEvo(chain: PokeApiEvoChain, acc: EvolutionStep[] = []): EvolutionStep[] {
          const idNum = parseInt(chain.species.url.split("/").filter(Boolean).pop() ?? "0");
          const detail = chain.evolution_details?.[0];
          let condition: string | null = null;
          if (detail) {
            if (detail.min_level) condition = `Lv. ${detail.min_level}`;
            else if (detail.item?.name) condition = detail.item.name.replace(/-/g, " ");
            else if (detail.trigger?.name === "trade") condition = "Trade";
            else if (detail.trigger?.name === "use-item") condition = "Use Item";
            else if (detail.trigger?.name === "level-up") condition = "Level Up";
            else if (detail.trigger?.name) condition = detail.trigger.name.replace(/-/g, " ");
          }
          acc.push({
            id: idNum,
            name: chain.species.name,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${idNum}.png`,
            minLevel: detail?.min_level ?? null,
            trigger: detail?.trigger?.name ?? null,
            item: detail?.item?.name ?? null,
            condition,
          });
          // Handle branching: pick the branch that contains the current Pokémon, or just the first
          const targetBranch = chain.evolves_to.find(b => {
            function containsId(node: PokeApiEvoChain, targetId: number): boolean {
              const nId = parseInt(node.species.url.split("/").filter(Boolean).pop() ?? "0");
              if (nId === targetId) return true;
              return node.evolves_to.some(c => containsId(c, targetId));
            }
            return containsId(b, data.id);
          }) ?? chain.evolves_to[0];
          if (targetBranch) collectEvo(targetBranch, acc);
          return acc;
        }

        const evolutions = collectEvo(evoData.chain);

        // English flavor text
        const flavorEntry = species.flavor_text_entries
          .filter((e: { language: { name: string }; flavor_text: string }) => e.language.name === "en")
          .pop();
        const flavorText = flavorEntry?.flavor_text.replace(/\f/g, " ").replace(/\n/g, " ") ?? "";

        // English genus
        const genus = species.genera
          .find((g: { language: { name: string }; genus: string }) => g.language.name === "en")?.genus ?? "";

        return {
          id: data.id,
          name: data.name,
          height: data.height,
          weight: data.weight,
          baseExperience: data.base_experience,
          types: data.types.map((t: { type: { name: string } }) => t.type.name),
          abilities: await Promise.all(data.abilities.map(async (a: { ability: { name: string; url: string }; is_hidden: boolean }) => {
            let description = "";
            try {
              const abilityRes = await fetch(a.ability.url);
              const abilityData = await abilityRes.json() as { effect_entries: { effect: string; language: { name: string } }[]; flavor_text_entries: { flavor_text: string; language: { name: string } }[] };
              const effectEntry = abilityData.effect_entries.find((e) => e.language.name === "en");
              const flavorEntry = abilityData.flavor_text_entries?.filter((e) => e.language.name === "en").pop();
              description = effectEntry?.effect ?? flavorEntry?.flavor_text ?? "";
            } catch { description = ""; }
            return { name: a.ability.name.replace(/-/g, " "), isHidden: a.is_hidden, description };
          })),
          stats: data.stats.map((s: { stat: { name: string }; base_stat: number }) => ({
            name: s.stat.name.replace(/-/g, " "),
            value: s.base_stat,
          })),
          sprites: {
            official: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${data.id}.png`,
            shiny: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${data.id}.png`,
            front: data.sprites.front_default,
            frontShiny: data.sprites.front_shiny,
          },
          evolutions,
          flavorText,
          genus,
          generation: species.generation.name.replace("generation-", "").toUpperCase(),
          isLegendary: species.is_legendary,
          isMythical: species.is_mythical,
          captureRate: species.capture_rate,
          baseHappiness: species.base_happiness,
          growthRate: species.growth_rate.name.replace(/-/g, " "),
          eggGroups: species.egg_groups.map((e: { name: string }) => e.name.replace(/-/g, " ")),
          color: species.color.name,
        };
        }); // end cached
      }),

    getTCGCards: publicProcedure
      .input(z.object({
        name: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(36).default(24),
      }))
      .query(async ({ input }) => {
        const result = await searchCards({
          q: `name:"${input.name}"`,
          page: input.page,
          pageSize: input.pageSize,
          orderBy: "-set.releaseDate",
        });
        return {
          cards: result.data.map((card: import('./lib/pokemontcg').PtcgCard) => ({
            id: card.id,
            name: card.name,
            image: card.images?.large ?? card.images?.small ?? "",
            set: card.set?.name ?? "",
            setId: card.set?.id ?? "",
            rarity: card.rarity ?? "",
            number: card.number ?? "",
            isSpecialRare: isSpecialRare(card.rarity),
            price: getPriceFromCard(card),
            links: {
              tcgplayer: card.tcgplayer?.url ?? getTcgPlayerUrl(card.name, card.set?.name ?? ""),
              ebay: getEbayUrl(card.name, card.set?.name ?? ""),
              cardmarket: card.cardmarket?.url ?? getCardMarketUrl(card.name),
            },
          })),
          totalCount: result.totalCount,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.totalCount / result.pageSize),
        };
      }),
  }),
});

// ─── PokeAPI types (internal) ──────────────────────────────────────────────
interface PokeApiPokemon {
  id: number; name: string; height: number; weight: number; base_experience: number;
  species: { url: string };
  types: { type: { name: string } }[];
  abilities: { ability: { name: string; url: string }; is_hidden: boolean }[];
  stats: { stat: { name: string }; base_stat: number }[];
  sprites: { front_default: string; front_shiny: string };
}
interface PokeApiSpecies {
  evolution_chain: { url: string };
  flavor_text_entries: { language: { name: string }; flavor_text: string }[];
  genera: { language: { name: string }; genus: string }[];
  generation: { name: string };
  is_legendary: boolean; is_mythical: boolean;
  capture_rate: number; base_happiness: number;
  growth_rate: { name: string };
  egg_groups: { name: string }[];
  color: { name: string };
}
interface PokeApiEvoChain {
  species: { name: string; url: string };
  evolution_details: { min_level: number | null; trigger: { name: string } | null; item: { name: string } | null }[];
  evolves_to: PokeApiEvoChain[];
}
interface EvolutionStep {
  id: number; name: string; sprite: string;
  minLevel: number | null; trigger: string | null; item: string | null;
  condition: string | null;
}

export type AppRouter = typeof appRouter;
