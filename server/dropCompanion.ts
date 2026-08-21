import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { DROP_RETAILER_META, type DropRetailer } from "../shared/drops";
import { ENV } from "./_core/env";
import {
  authenticateDropCompanionToken,
  listRecentDropEvents,
} from "./dropMonitorDb";

const buckets = new Map<string, { startedAt: number; count: number }>();

function allowRequest(key: string) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 30;
}

export async function dropCompanionNextHandler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  const authorization = req.headers.authorization ?? "";
  const rawToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!/^rgd_[A-Za-z0-9_-]{40,}$/.test(rawToken)) {
    return res.status(401).json({ error: "invalid companion token" });
  }
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  if (!allowRequest(tokenHash)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "shortcut rate limit exceeded" });
  }
  const token = await authenticateDropCompanionToken(tokenHash);
  if (!token) return res.status(401).json({ error: "expired companion token" });

  const afterId = Math.max(0, Number.parseInt(String(req.query.after ?? "0"), 10) || 0);
  const events = await listRecentDropEvents(token.userId, 50);
  const event = events.find(row => row.id > afterId);
  if (!event) {
    return res.json({
      available: false,
      nextCheckSeconds: 5,
      dropPage: `${ENV.appUrl || "https://raritygrid.com"}/drops`,
    });
  }
  const retailer = event.retailer as DropRetailer;
  return res.json({
    available: true,
    eventId: event.id,
    eventType: event.eventType,
    title: event.title,
    retailer,
    retailerName: DROP_RETAILER_META[retailer]?.name ?? event.retailer,
    price: event.priceCents === null ? null : event.priceCents / 100,
    currency: event.currency,
    productUrl: event.productUrl,
    detectedAt: event.detectedAt.toISOString(),
    observedAt: event.observedAt.toISOString(),
  });
}
