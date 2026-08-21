import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { DropProviderPayload } from "../shared/drops";
import { ENV } from "./_core/env";
import { ingestDropProviderProducts } from "./dropMonitor";
import {
  dropProviderCovers,
  parseDropProviderPayload,
} from "./dropProvider";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export function verifyDropProviderSignature(input: {
  body: Buffer;
  timestamp?: string;
  signature?: string;
}) {
  if (!ENV.dropProviderWebhookSecret) return false;
  if (!input.timestamp || !input.signature) return false;
  const timestamp = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1_000) - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }
  const supplied = input.signature.startsWith("sha256=")
    ? input.signature.slice(7)
    : input.signature;
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", ENV.dropProviderWebhookSecret)
    .update(`${input.timestamp}.`)
    .update(input.body)
    .digest();
  const received = Buffer.from(supplied, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function dropProviderWebhookHandler(req: Request, res: Response) {
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const timestamp = req.headers["x-raritygrid-timestamp"] as string | undefined;
  const signature = req.headers["x-raritygrid-signature"] as string | undefined;
  if (!verifyDropProviderSignature({ body, timestamp, signature })) {
    return res.status(401).json({ error: "invalid provider signature" });
  }
  let payload: DropProviderPayload;
  try {
    payload = parseDropProviderPayload(JSON.parse(body.toString("utf8")));
    if (payload.products.some(product => !dropProviderCovers(product.retailer))) {
      return res.status(400).json({ error: "provider retailer is not enabled" });
    }
  } catch {
    return res.status(400).json({ error: "invalid provider payload" });
  }
  try {
    const result = await ingestDropProviderProducts(payload.products);
    return res.json({ received: true, requestId: payload.requestId, ...result });
  } catch (error) {
    console.error(
      "[drop-monitor] provider event processing failed",
      error instanceof Error ? error.name : "unknown error"
    );
    return res.status(503).json({ error: "drop monitor temporarily unavailable" });
  }
}
