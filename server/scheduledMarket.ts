import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { captureMarketSnapshot } from "./marketSnapshot";

/** Protected daily collector-market refresh endpoint. */
export async function marketSnapshotHandler(req: Request, res: Response) {
  if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only endpoint" });
  }
  try {
    const result = await captureMarketSnapshot(Boolean(req.body?.force));
    return res.json(result);
  } catch (error) {
    console.error("[market] scheduled snapshot failed:", error);
    return res.status(502).json({ error: "Market snapshot failed" });
  }
}
