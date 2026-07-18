/**
 * Scheduled handler: /api/scheduled/auto-release
 *
 * Called hourly by a GitHub Actions cron. Releases the escrow for orders that
 * are past their auto-release window:
 *   - delivered + 7 days without a dispute  → payout to seller
 *   - shipped + 21 days without buyer confirmation/dispute → payout (fallback)
 * Disputed/cancelled orders never match (status filter).
 */
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import {
  cancelExpiredCheckoutReservations,
  getOrdersDueForRelease,
  releaseOrder,
} from "./storeDb";

export async function autoReleaseHandler(req: Request, res: Response) {
  if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only endpoint (x-cron-secret inválido)" });
  }

  const expiredReservations = await cancelExpiredCheckoutReservations();
  const due = await getOrdersDueForRelease();
  let released = 0;
  const failures: number[] = [];
  for (const o of due) {
    try {
      if (await releaseOrder(o.id)) released++;
    } catch (e) {
      failures.push(o.id);
      console.error(`[auto-release] order #${o.id} failed:`, e);
    }
  }
  console.log(`[auto-release] due=${due.length} released=${released} failed=${failures.length}`);
  return res.json({
    expiredReservations,
    due: due.length,
    released,
    failures,
  });
}
