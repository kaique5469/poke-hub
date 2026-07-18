import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { authenticateRequest } from "./_core/auth";
import { ENV } from "./_core/env";
import { analyzeCardImage, confirmScannerMatches } from "./cardScanner";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DAILY_LIMIT = 10;
const dailyBuckets = new Map<number, { day: string; count: number }>();
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

export function consumeScannerQuota(
  userId: number,
  ip: string,
  now = new Date()
) {
  const timestamp = now.getTime();
  const minute = minuteBuckets.get(ip);
  if (!minute || minute.resetAt <= timestamp) {
    minuteBuckets.set(ip, { resetAt: timestamp + 60_000, count: 1 });
  } else {
    minute.count += 1;
    if (minute.count > 3) return { allowed: false, retryAfter: 60 };
  }

  const day = now.toISOString().slice(0, 10);
  let daily = dailyBuckets.get(userId);
  if (!daily || daily.day !== day) {
    daily = { day, count: 1 };
    dailyBuckets.set(userId, daily);
  } else {
    daily.count += 1;
    if (daily.count > DAILY_LIMIT) {
      return { allowed: false, retryAfter: 86_400 };
    }
  }

  if (dailyBuckets.size > 10_000) {
    for (const [key, bucket] of dailyBuckets) {
      if (bucket.day !== day) dailyBuckets.delete(key);
    }
  }
  return {
    allowed: true,
    remaining: Math.max(0, DAILY_LIMIT - daily.count),
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

async function requireScannerUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Sign in to use the card scanner." });
    }
    res.locals.scannerUserId = user.id;
    return next();
  } catch (error) {
    console.error("[scanner] authentication failed", error);
    return res.status(500).json({ error: "The scanner is unavailable." });
  }
}

export function registerScannerRoutes(app: Express) {
  app.post(
    "/api/scanner/identify",
    requireScannerUser,
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

      const quota = consumeScannerQuota(
        res.locals.scannerUserId,
        clientIp(req)
      );
      if (!quota.allowed) {
        res.setHeader("Retry-After", String(quota.retryAfter));
        return res.status(429).json({
          error:
            quota.retryAfter === 60
              ? "Too many scans at once. Wait a minute and try again."
              : "Daily scan limit reached. Try again tomorrow.",
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
          analysis,
          matches,
          quota: { remaining: quota.remaining ?? 0, dailyLimit: DAILY_LIMIT },
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
