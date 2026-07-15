import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { syncScrydexSealedProducts } from "./scrydexSync";

/** Protected daily catalog refresh endpoint. */
export async function scrydexSyncHandler(req: Request, res: Response) {
  if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only endpoint" });
  }
  try {
    const result = await syncScrydexSealedProducts(Boolean(req.body?.force));
    return res.json(result);
  } catch (error) {
    console.error("[scrydex] scheduled sync failed:", error);
    return res.status(502).json({ error: "Scrydex sync failed" });
  }
}

