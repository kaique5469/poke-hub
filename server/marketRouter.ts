import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getUserByOpenId } from "./db";
import {
  getCardMarketSummary,
  getCollectorPortfolio,
  getMarketOverview,
  getUserMarketWatchlist,
  isCardWatched,
  recordMarketEvent,
  toggleMarketWatch,
  updateMarketWatchTarget,
} from "./marketPulseDb";
import { ensureMarketSnapshot } from "./marketSnapshot";

const externalId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, "Invalid card identifier");

const cardIdentity = z.object({
  cardId: externalId,
  cardName: z.string().trim().min(1).max(256),
  setId: externalId.nullish(),
  setName: z.string().trim().max(256).nullish(),
  imageUrl: z
    .string()
    .url()
    .max(2048)
    .refine(value => value.startsWith("https://"), "HTTPS image required")
    .nullish(),
});

async function requireDbUser(openId: string) {
  const user = await getUserByOpenId(openId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return user;
}

export const marketRouter = router({
  overview: publicProcedure
    .input(
      z.object({
        period: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
      })
    )
    .query(async ({ input }) => {
      // Refresh in the background so an upstream delay never blocks the page.
      // The client refetches the overview after the snapshot is persisted.
      void ensureMarketSnapshot();
      return getMarketOverview(input.period);
    }),

  card: publicProcedure
    .input(
      z.object({
        cardId: externalId,
        days: z.number().int().min(7).max(365).default(90),
      })
    )
    .query(async ({ input }) => {
      void ensureMarketSnapshot();
      return getCardMarketSummary(input.cardId, input.days);
    }),

  recordEvent: publicProcedure
    .input(
      z.object({
        sessionId: z.string().trim().min(8).max(64),
        // Watchlist events are emitted only by the authenticated toggle
        // procedure so a public client cannot manufacture that signal.
        eventType: z.enum(["search", "card_view"]),
        card: cardIdentity.nullish(),
        query: z.string().trim().max(128).nullish(),
        metadata: z
          .object({ surface: z.string().trim().max(64).optional() })
          .strict()
          .nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user
        ? await getUserByOpenId(ctx.user.openId).catch(() => undefined)
        : undefined;
      return recordMarketEvent({
        ...input,
        userId: user?.id ?? null,
      });
    }),

  watchStatus: protectedProcedure
    .input(z.object({ cardId: externalId }))
    .query(async ({ ctx, input }) => {
      const user = await requireDbUser(ctx.user.openId);
      return isCardWatched(user.id, input.cardId);
    }),

  toggleWatch: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().trim().min(8).max(64),
        card: cardIdentity,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await requireDbUser(ctx.user.openId);
      const result = await toggleMarketWatch(user.id, input.card);
      await recordMarketEvent({
        sessionId: input.sessionId,
        userId: user.id,
        eventType: result.watching ? "watchlist_add" : "watchlist_remove",
        card: input.card,
      });
      return result;
    }),

  setTarget: protectedProcedure
    .input(
      z.object({
        cardId: externalId,
        targetPriceUsd: z.number().positive().max(1_000_000).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await requireDbUser(ctx.user.openId);
      return updateMarketWatchTarget(
        user.id,
        input.cardId,
        input.targetPriceUsd
      );
    }),

  watchlist: protectedProcedure.query(async ({ ctx }) => {
    const user = await requireDbUser(ctx.user.openId);
    return getUserMarketWatchlist(user.id);
  }),

  portfolio: protectedProcedure.query(async ({ ctx }) => {
    const user = await requireDbUser(ctx.user.openId);
    return getCollectorPortfolio(user.id);
  }),
});
