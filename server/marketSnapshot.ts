import type { InsertMarketPriceSnapshot } from "../drizzle/schema";
import {
  getScrydexCardMarketPrice,
  getScrydexCardsByIds,
  scrydexConfigured,
  type ScrydexCard,
} from "./lib/scrydex";
import {
  getCardsByIds,
  getHighValueCards,
  getPriceFromCard,
  type PtcgCard,
} from "./lib/pokemontcg";
import {
  getLatestMarketSnapshotAt,
  getTrackedMarketCards,
  insertMarketSnapshots,
  processMarketPriceAlerts,
  type MarketCardIdentity,
} from "./marketPulseDb";

const MAX_TRACKED_CARDS = 100;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type MarketSnapshotResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  candidates: number;
  priced: number;
  inserted: number;
  alertsTriggered: number;
  scrydexPriced: number;
  fallbackPriced: number;
};

function scrydexImage(card: ScrydexCard) {
  const images = card.images ?? [];
  const front =
    images.find(image => image.type?.toLowerCase() === "front") ?? images[0];
  return front?.large ?? front?.medium ?? front?.small ?? null;
}

function fromPtcg(card: PtcgCard): MarketCardIdentity {
  return {
    cardId: card.id,
    cardName: card.name,
    setId: card.set?.id ?? null,
    setName: card.set?.name ?? null,
    imageUrl: card.images?.large ?? card.images?.small ?? null,
  };
}

async function buildCandidateUniverse() {
  const tracked = await getTrackedMarketCards(MAX_TRACKED_CARDS);
  const candidates = new Map(tracked.map(card => [card.cardId, card]));

  // A new installation has no demand history yet. Seed only the tracking
  // universe (not movement) with recent high-rarity cards from the real API.
  for (let page = 1; page <= 4 && candidates.size < 80; page += 1) {
    try {
      const result = await getHighValueCards(page);
      for (const card of result.data) {
        if (!candidates.has(card.id)) candidates.set(card.id, fromPtcg(card));
        if (candidates.size >= MAX_TRACKED_CARDS) break;
      }
    } catch (error) {
      console.warn("[market] unable to extend candidate universe:", error);
      break;
    }
  }
  return Array.from(candidates.values()).slice(0, MAX_TRACKED_CARDS);
}

function scrydexSnapshot(card: ScrydexCard): InsertMarketPriceSnapshot | null {
  const price = getScrydexCardMarketPrice(card);
  if (!price) return null;
  return {
    cardId: card.id,
    cardName: card.name,
    setId: card.expansion?.id ?? null,
    setName: card.expansion?.name ?? null,
    imageUrl: scrydexImage(card),
    source: "Scrydex",
    variant: price.variant,
    condition: "NM",
    currency: "USD",
    marketPriceUsd: price.market.toFixed(2),
    lowPriceUsd: price.low == null ? null : price.low.toFixed(2),
  };
}

function ptcgSnapshot(card: PtcgCard): InsertMarketPriceSnapshot | null {
  const price = getPriceFromCard(card);
  const market = Number(price?.market ?? price?.mid ?? price?.low ?? 0);
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
}

let running: Promise<MarketSnapshotResult> | null = null;
let lastSuccessfulRun = 0;

export async function captureMarketSnapshot(
  force = false
): Promise<MarketSnapshotResult> {
  if (!force && !lastSuccessfulRun) {
    const latest = await getLatestMarketSnapshotAt();
    if (latest && Date.now() - latest.getTime() < REFRESH_INTERVAL_MS) {
      lastSuccessfulRun = latest.getTime();
    }
  }
  if (
    !force &&
    lastSuccessfulRun &&
    Date.now() - lastSuccessfulRun < REFRESH_INTERVAL_MS
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "fresh",
      candidates: 0,
      priced: 0,
      inserted: 0,
      alertsTriggered: 0,
      scrydexPriced: 0,
      fallbackPriced: 0,
    };
  }
  const candidates = await buildCandidateUniverse();
  const ids = candidates.map(card => card.cardId);
  const snapshots = new Map<string, InsertMarketPriceSnapshot>();
  let scrydexPriced = 0;

  if (scrydexConfigured() && ids.length > 0) {
    try {
      const cards = await getScrydexCardsByIds(ids);
      for (const card of cards) {
        const snapshot = scrydexSnapshot(card);
        if (!snapshot) continue;
        snapshots.set(card.id, snapshot);
        scrydexPriced += 1;
      }
    } catch (error) {
      // Starter-plan quotas or an upstream outage must not take the market
      // page down. The named TCGPlayer fallback remains a real data source.
      console.warn("[market] Scrydex card snapshot unavailable:", error);
    }
  }

  let fallbackPriced = 0;
  const missing = ids.filter(id => !snapshots.has(id));
  if (missing.length > 0) {
    try {
      const cards = await getCardsByIds(missing);
      for (const card of cards) {
        const snapshot = ptcgSnapshot(card);
        if (!snapshot) continue;
        snapshots.set(card.id, snapshot);
        fallbackPriced += 1;
      }
    } catch (error) {
      console.warn("[market] TCGPlayer fallback snapshot unavailable:", error);
    }
  }

  // Preserve identity gathered from user activity when an upstream result is
  // missing non-price metadata.
  const identity = new Map(candidates.map(card => [card.cardId, card]));
  const rows = Array.from(snapshots.values()).map(row => {
    const known = identity.get(row.cardId);
    return {
      ...row,
      cardName: row.cardName || known?.cardName || row.cardId,
      setId: row.setId ?? known?.setId ?? null,
      setName: row.setName ?? known?.setName ?? null,
      imageUrl: row.imageUrl ?? known?.imageUrl ?? null,
    };
  });
  const inserted = await insertMarketSnapshots(rows, force ? 0 : 6);
  const alertsTriggered = await processMarketPriceAlerts(
    rows.map(row => ({
      cardId: row.cardId,
      cardName: row.cardName,
      price: Number(row.marketPriceUsd),
    }))
  );
  if (rows.length > 0) lastSuccessfulRun = Date.now();
  return {
    ok: rows.length > 0,
    skipped: false,
    reason: rows.length > 0 ? undefined : "no_prices",
    candidates: candidates.length,
    priced: rows.length,
    inserted,
    alertsTriggered,
    scrydexPriced,
    fallbackPriced,
  };
}

export function ensureMarketSnapshot() {
  if (!running) {
    running = captureMarketSnapshot(false)
      .catch(error => {
        console.error("[market] snapshot failed:", error);
        return {
          ok: false,
          skipped: false,
          reason: "error",
          candidates: 0,
          priced: 0,
          inserted: 0,
          alertsTriggered: 0,
          scrydexPriced: 0,
          fallbackPriced: 0,
        };
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}
