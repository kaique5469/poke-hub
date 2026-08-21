import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  DROP_RETAILERS,
  dropRetailerCurrency,
  normalizeProductUrl,
  type DropRetailer,
} from "../shared/drops";
import { ENV } from "./_core/env";
import { protectedProcedure, router } from "./_core/trpc";
import { getUserByOpenId } from "./db";
import {
  createDropMonitor,
  createDropCompanionToken,
  createDropReleaseWindow,
  deleteDropMonitor,
  deleteDropReleaseWindow,
  getDropMonitor,
  listDropMonitors,
  listDropCompanionTokens,
  listDropReleaseWindows,
  listRecentDropEvents,
  updateDropMonitor,
  updateDropReleaseWindow,
  revokeDropCompanionToken,
} from "./dropMonitorDb";
import { isWithinDropWindow, runDropMonitor } from "./dropMonitor";
import {
  dropProviderConfigured,
  dropProviderCoverage,
} from "./dropProvider";
import {
  removeDropPushSubscription,
  upsertDropPushSubscription,
  webPushConfigured,
} from "./webPush";

const retailerSchema = z.enum(DROP_RETAILERS);
const monitorModeSchema = z.enum(["always", "release_windows"]);
const checksByUser = new Map<number, number>();

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function currentUser(openId: string) {
  const user = await getUserByOpenId(openId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return user;
}

const monitorInput = z
  .object({
    productName: z.string().trim().min(2).max(512),
    retailer: retailerSchema,
    productUrl: z.string().trim().url().max(2_048).optional(),
    searchQuery: z.string().trim().min(2).max(512).optional(),
    maxPriceCents: z.number().int().min(1).max(100_000_000).optional(),
    desiredQuantity: z.number().int().min(1).max(4).default(1),
    monitorMode: monitorModeSchema.default("always"),
  })
  .superRefine((input, ctx) => {
    if (
      input.productUrl &&
      !normalizeProductUrl(input.retailer, input.productUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productUrl"],
        message: "Product URL must belong to the selected retailer",
      });
    }
  });

const windowInputShape = {
  retailer: retailerSchema,
  label: z.string().trim().min(2).max(160),
  timezone: z.string().trim().min(3).max(64),
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1_439),
  endMinute: z.number().int().min(0).max(1_439),
  burstIntervalSeconds: z.number().int().min(3).max(60),
  isActive: z.boolean(),
};

const windowInput = z
  .object({
    ...windowInputShape,
    isActive: z.boolean().default(true),
  })
  .superRefine((input, ctx) => {
    if (!validTimezone(input.timezone)) {
      ctx.addIssue({
        code: "custom",
        path: ["timezone"],
        message: "Invalid IANA timezone",
      });
    }
  });

export const dropMonitorRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const user = await currentUser(ctx.user.openId);
    const windows = await listDropReleaseWindows(user.id);
    const now = new Date();
    return {
      workerEnabled: ENV.dropWorkerEnabled,
      providerConnected: dropProviderConfigured(),
      providerRetailers: dropProviderCoverage(),
      normalIntervalSeconds: ENV.dropNormalIntervalSeconds,
      defaultBurstIntervalSeconds: ENV.dropBurstIntervalSeconds,
      delivery: {
        inApp: true,
        webPush: webPushConfigured(),
        email: Boolean(ENV.resendApiKey && user.email),
        discord: user.role === "admin" && Boolean(ENV.dropDiscordWebhookUrl),
        telegram: Boolean(
          user.role === "admin" &&
            ENV.dropTelegramBotToken &&
            ENV.dropTelegramChatId
        ),
      },
      vapidPublicKey: webPushConfigured() ? ENV.dropVapidPublicKey : null,
      activeWindows: windows
        .filter(window => isWithinDropWindow(now, window))
        .map(window => window.id),
      autoCart: {
        enabled: false,
        mode: "open_product" as const,
        reason:
          "Retailer-approved delegated access is required. Checkout is never automated.",
      },
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await currentUser(ctx.user.openId);
    return listDropMonitors(user.id);
  }),

  create: protectedProcedure
    .input(monitorInput)
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser(ctx.user.openId);
      const productUrl = input.productUrl
        ? normalizeProductUrl(input.retailer, input.productUrl)
        : null;
      const monitor = await createDropMonitor({
        userId: user.id,
        retailer: input.retailer,
        productName: input.productName,
        productUrl,
        searchQuery: input.searchQuery ?? input.productName,
        maxPriceCents: input.maxPriceCents ?? null,
        currency: dropRetailerCurrency(input.retailer),
        desiredQuantity: input.desiredQuantity,
        monitorMode: input.monitorMode,
        handoffMode: "open_product",
        isActive: true,
      });
      if (monitor && dropProviderConfigured()) {
        await runDropMonitor(monitor).catch(() => undefined);
        return getDropMonitor(monitor.id, user.id);
      }
      return monitor;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        isActive: z.boolean().optional(),
        monitorMode: monitorModeSchema.optional(),
        maxPriceCents: z.number().int().min(1).max(100_000_000).nullable().optional(),
        desiredQuantity: z.number().int().min(1).max(4).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser(ctx.user.openId);
      const { id, ...values } = input;
      const monitor = await updateDropMonitor(id, user.id, values);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND" });
      return monitor;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser(ctx.user.openId);
      return { success: await deleteDropMonitor(input.id, user.id) };
    }),

  checkNow: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser(ctx.user.openId);
      if (!dropProviderConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect an authorized inventory provider first",
        });
      }
      const now = Date.now();
      const last = checksByUser.get(user.id) ?? 0;
      if (now - last < 20_000) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Wait 20 seconds before checking again",
        });
      }
      const monitor = await getDropMonitor(input.id, user.id);
      if (!monitor) throw new TRPCError({ code: "NOT_FOUND" });
      checksByUser.set(user.id, now);
      try {
        return await runDropMonitor(monitor);
      } catch (error) {
        console.error(
          "[drop-monitor] manual check failed",
          error instanceof Error ? error.name : "unknown error"
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Monitor check failed. Try again shortly.",
        });
      }
    }),

  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const user = await currentUser(ctx.user.openId);
      return listRecentDropEvents(user.id, input.limit);
    }),

  push: router({
    subscribe: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(2_048),
          keys: z.object({
            p256dh: z.string().min(40).max(192),
            auth: z.string().min(16).max(64),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        if (!webPushConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Web Push is not configured",
          });
        }
        await upsertDropPushSubscription({
          userId: user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: ctx.req.headers["user-agent"] ?? null,
        });
        return { success: true };
      }),
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(2_048) }))
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        await removeDropPushSubscription(user.id, input.endpoint);
        return { success: true };
      }),
  }),

  companion: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = await currentUser(ctx.user.openId);
      return listDropCompanionTokens(user.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120).default("iPhone Shortcut"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        const rawToken = `rgd_${randomBytes(32).toString("base64url")}`;
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);
        const id = await createDropCompanionToken({
          userId: user.id,
          name: input.name,
          tokenHash,
          expiresAt,
        });
        return { id, token: rawToken, expiresAt };
      }),
    revoke: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        await revokeDropCompanionToken(input.id, user.id);
        return { success: true };
      }),
  }),

  windows: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = await currentUser(ctx.user.openId);
      return listDropReleaseWindows(user.id);
    }),
    create: protectedProcedure
      .input(windowInput)
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        return createDropReleaseWindow({ ...input, userId: user.id });
      }),
    update: protectedProcedure
      .input(
        z.object(windowInputShape).partial().extend({
          id: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        const { id, ...values } = input;
        if (values.timezone && !validTimezone(values.timezone)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid IANA timezone",
          });
        }
        await updateDropReleaseWindow(id, user.id, values);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const user = await currentUser(ctx.user.openId);
        await deleteDropReleaseWindow(input.id, user.id);
        return { success: true };
      }),
  }),
});
