import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { authenticateRequest } from "./_core/auth";
import { ENV } from "./_core/env";
import { analyzeCardImage, confirmScannerMatches } from "./cardScanner";
import { SCANNER_QUOTAS, isPro, normalizeVariant } from "@shared/app";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Quota buckets are in memory on purpose: they cap the per-scan AI cost on a
 * single Railway instance and reset on deploy. Keys are `user:<id>` for
 * signed-in users and `ip:<addr>` for anonymous scans.
 */
const dailyBuckets = new Map<string, { day: string; count: number }>();
const minuteBuckets = new Map<string, { resetAt: number; count: number }>();

function clientIp(req: Request) {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ||
    req.ip ||
    "unknown"
  );
}

export type ScannerTier = "anonymous" | "free" | "pro";

export function dailyLimitFor(tier: ScannerTier) {
  if (tier === "pro") return SCANNER_QUOTAS.proPerDay;
  if (tier === "free") return SCANNER_QUOTAS.freePerDay;
  return SCANNER_QUOTAS.anonymousPerDay;
}

/**
 * Legacy signature kept for existing tests: `(userId, ip)` behaves like a
 * signed-in free user. The object form carries the tier.
 */
export function consumeScannerQuota(
  subject: number | { key: string; tier: ScannerTier },
  ip: string,
  now = new Date()
) {
  const key =
    typeof subject === "number" ? `user:${subject}` : subject.key;
  const tier: ScannerTier =
    typeof subject === "number" ? "free" : subject.tier;
  const dailyLimit = dailyLimitFor(tier);

  const timestamp = now.getTime();
  const minute = minuteBuckets.get(ip);
  if (!minute || minute.resetAt <= timestamp) {
    minuteBuckets.set(ip, { resetAt: timestamp + 60_000, count: 1 });
  } else {
    minute.count += 1;
    if (minute.count > SCANNER_QUOTAS.perMinutePerIp) {
      return { allowed: false as const, retryAfter: 60, dailyLimit };
    }
  }

  const day = now.toISOString().slice(0, 10);
  let daily = dailyBuckets.get(key);
  if (!daily || daily.day !== day) {
    daily = { day, count: 1 };
    dailyBuckets.set(key, daily);
  } else {
    daily.count += 1;
    if (daily.count > dailyLimit) {
      return { allowed: false as const, retryAfter: 86_400, dailyLimit };
    }
  }

  if (dailyBuckets.size > 20_000) {
    for (const [bucketKey, bucket] of dailyBuckets) {
      if (bucket.day !== day) dailyBuckets.delete(bucketKey);
    }
  }
  return {
    allowed: true as const,
    remaining: Number.isFinite(dailyLimit)
      ? Math.max(0, dailyLimit - daily.count)
      : null,
    dailyLimit,
  };
}

function rawImage(req: Request, res: Response, next: NextFunction) {
  if (!ALLOWED_TYPES.has(req.headers["content-type"] ?? "")) {
    return res.status(415).json({
      error: "Use a JPEG, PNG, or WebP image.",
    });
  }
  return express.raw({ type: [...ALLOWED_TYPES], limit: "3mb" })(
    req,
    res,
    next
  );
}

/**
 * Anonymous scans are allowed: the first scan is the activation moment and
 * must happen before any sign-up wall. A signed-in user gets a larger daily
 * budget keyed by user id instead of IP (shared Wi-Fi, carrier NAT).
 */
async function resolveScannerSubject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authenticateRequest(req);
    if (user) {
      res.locals.scannerSubject = {
        key: `user:${user.id}`,
        tier: (isPro(user) ? "pro" : "free") as ScannerTier,
        userId: user.id,
      };
    } else {
      res.locals.scannerSubject = {
        key: `ip:${clientIp(req)}`,
        tier: "anonymous" as ScannerTier,
        userId: null,
      };
    }
    return next();
  } catch (error) {
    console.error("[scanner] authentication failed", error);
    return res.status(500).json({ error: "The scanner is unavailable." });
  }
}

export function registerScannerRoutes(app: Express) {
  app.post(
    "/api/scanner/identify",
    resolveScannerSubject,
    rawImage,
    async (req, res) => {
      if (!ENV.openaiApiKey) {
        return res.status(503).json({
          error: "The card scanner is temporarily unavailable.",
        });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length < 8_000) {
        return res
          .status(400)
          .json({ error: "The image is empty or too small." });
      }

      const subject = res.locals.scannerSubject as {
        key: string;
        tier: ScannerTier;
        userId: number | null;
      };
      const quota = consumeScannerQuota(subject, clientIp(req));
      if (!quota.allowed) {
        res.setHeader("Retry-After", String(quota.retryAfter));
        return res.status(429).json({
          error:
            quota.retryAfter === 60
              ? "Too many scans at once. Wait a minute and try again."
              : subject.tier === "anonymous"
                ? "Daily scan limit reached. Create a free account for a bigger daily budget."
                : "Daily scan limit reached. Try again tomorrow.",
          code:
            quota.retryAfter === 60
              ? "rate_limited"
              : subject.tier === "anonymous"
                ? "anonymous_limit"
                : "daily_limit",
          tier: subject.tier,
        });
      }

      try {
        const analysis = await analyzeCardImage(
          req.body,
          req.headers["content-type"] as
            "image/jpeg" | "image/png" | "image/webp"
        );
        const matches = await confirmScannerMatches(analysis);
        return res.json({
          analysis: {
            ...analysis,
            normalizedVariant: normalizeVariant(analysis.variant),
          },
          matches,
          quota: {
            remaining: quota.remaining,
            dailyLimit: Number.isFinite(quota.dailyLimit)
              ? quota.dailyLimit
              : null,
            tier: subject.tier,
          },
          privacy: "Image processed in memory and not stored by RarityGrid.",
        });
      } catch (error) {
        console.error("[scanner] identification failed", error);
        return res.status(502).json({
          error:
            "We could not identify this photo. Try better lighting or manual search.",
        });
      }
    }
  );
}
