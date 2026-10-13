/**
 * Daily refresh of collection prices.
 *
 * `binder_cards.priceUsd` was only set at add time, so a collection's value
 * drifted from the market within days — the top data complaint about every
 * scanner app. This job re-prices every distinct (card, variant) pair held
 * by any user, variant-aware, and writes a market snapshot per card so the
 * portfolio's 7-day change and history work for cards nobody "tracks".
 *
 * Runs from POST /api/scheduled/binder-prices (x-cron-secret) — wire it to
 * the existing daily-market workflow — and is idempotent.
 */
import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { binderCards, priceHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { getCardsByIds, getPriceFromCard, getVariantPrice, type PtcgCard } from "./lib/pokemontcg";
import { insertMarketSnapshots } from "./marketPulseDb";
import { isCardVariant, type CardVariant } from "@shared/app";

const BATCH = 200;
/** Upper bound per run; a bigger collection base is refreshed across runs. */
const MAX_CARDS_PER_RUN = 4_000;

export type BinderPriceRefreshResult = {
  ok: boolean;
  cards: number;
  pairs: number;
  updatedRows: number;
  snapshots: number;
  missing: number;
  durationMs: number;
};

export async function listBinderCardVariantPairs(limit = MAX_CARDS_PER_RUN) {
  const db = await getDb();
  if (!db) return [];
  // Oldest-updated cards first so a huge base still rotates fully.
  const rows = await db
    .select({
      cardId: binderCards.cardId,
      variant: binderCards.variant,
      oldest: sql<Date>`MIN(${binderCards.updatedAt})`,
    })
    .from(binderCards)
    .groupBy(binderCards.cardId, binderCards.variant)
    .orderBy(sql`MIN(${binderCards.updatedAt})`)
    .limit(limit);
  return rows.map(r => ({
    cardId: r.cardId,
    variant: (isCardVariant(r.variant) ? r.variant : "normal") as CardVariant,
  }));
}

/** Pure: which (card, variant) pairs get which price from a card payload. */
export function priceUpdatesFor(
  cards: PtcgCard[],
  pairs: Array<{ cardId: string; variant: CardVariant }>
) {
  const byId = new Map(cards.map(c => [c.id, c]));
  const updates: Array<{ cardId: string; variant: CardVariant; priceUsd: string | null }> = [];
  let missing = 0;
  for (const pair of pairs) {
    const card = byId.get(pair.cardId);
    if (!card) {
      missing += 1;
      continue;
    }
    const { price } = getVariantPrice(card, pair.variant);
    const value = price?.market ?? price?.mid ?? null;
    updates.push({
      ...pair,
      priceUsd: value == null || !Number.isFinite(Number(value)) ? null : Number(value).toFixed(2),
    });
  }
  return { updates, missing };
}

let running: Promise<BinderPriceRefreshResult> | null = null;

export async function refreshBinderPrices(): Promise<BinderPriceRefreshResult> {
  if (running) return running;
  running = (async () => {
    const started = Date.now();
    const db = await getDb();
    if (!db) {
      return { ok: false, cards: 0, pairs: 0, updatedRows: 0, snapshots: 0, missing: 0, durationMs: 0 };
    }
    const pairs = await listBinderCardVariantPairs();
    const ids = Array.from(new Set(pairs.map(p => p.cardId)));
    let updatedRows = 0;
    let snapshots = 0;
    let missing = 0;

    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      let cards: PtcgCard[] = [];
      try {
        cards = await getCardsByIds(chunk);
      } catch (error) {
        console.warn("[binder-prices] catalog batch failed", error);
        continue;
      }
      const chunkPairs = pairs.filter(p => chunk.includes(p.cardId));
      const result = priceUpdatesFor(cards, chunkPairs);
      missing += result.missing;
      for (const u of result.updates) {
        if (u.priceUsd == null) continue;
        const res = await db
          .update(binderCards)
          .set({ priceUsd: u.priceUsd })
          .where(and(eq(binderCards.cardId, u.cardId), eq(binderCards.variant, u.variant)));
        updatedRows += Number((res as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
      }
      // Per-card market snapshot (best bucket) + raw history row.
      const rows = cards
        .map(card => {
          const price = getPriceFromCard(card);
          const market = Number(price?.market ?? price?.mid ?? 0);
          if (!Number.isFinite(market) || market <= 0) return null;
          return {
            cardId: card.id,
            cardName: card.name,
            setId: card.set?.id ?? null,
            setName: card.set?.name ?? null,
            imageUrl: card.images?.large ?? card.images?.small ?? null,
            source: "TCGPlayer via Pokemon TCG API",
            variant: "market",
            condition: "NM",
            currency: "USD",
            marketPriceUsd: market.toFixed(2),
            lowPriceUsd:
              price?.low == null || !Number.isFinite(Number(price.low))
                ? null
                : Number(price.low).toFixed(2),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      try {
        snapshots += await insertMarketSnapshots(rows, 20);
        if (rows.length > 0) {
          await db.insert(priceHistory).values(
            rows.map(r => ({
              cardId: r.cardId,
              tcgMarket: r.marketPriceUsd,
              tcgLow: r.lowPriceUsd,
              tcgHigh: null,
            }))
          );
        }
      } catch (error) {
        console.warn("[binder-prices] snapshot insert failed", error);
      }
    }
    return {
      ok: true,
      cards: ids.length,
      pairs: pairs.length,
      updatedRows,
      snapshots,
      missing,
      durationMs: Date.now() - started,
    };
  })().finally(() => {
    running = null;
  });
  return running;
}

/** POST /api/scheduled/binder-prices — protected by x-cron-secret. */
export async function binderPricesHandler(req: Request, res: Response) {
  if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
    return res.status(403).json({ error: "cron-only endpoint" });
  }
  try {
    return res.json(await refreshBinderPrices());
  } catch (error) {
    console.error("[binder-prices] refresh failed:", error);
    return res.status(502).json({ error: "Binder price refresh failed" });
  }
}
