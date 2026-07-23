import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { finalizeExpiredCompetitions } from "./gameCompetitionDb";

export async function weeklyGameHandler(req: Request, res: Response) {
  if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only endpoint" });
  }
  try {
    const finalized = await finalizeExpiredCompetitions();
    return res.json({ ok: true, finalized: finalized.length });
  } catch (error) {
    console.error("[weekly-game] finalize failed", error);
    return res.status(500).json({ error: "weekly game finalization failed" });
  }
}
