/**
 * Auto-seeder for the sealed-product catalog.
 *
 * Generates real products from the most recent pokemontcg.io sets (booster
 * box, ETB, single booster, blister per set) plus a small evergreen accessory
 * catalog. Idempotent by slug — safe to call on every boot; it only inserts
 * missing rows.
 */
import { countProducts, upsertProductBySlug } from "./marketplaceDb";
import { getSets } from "./lib/pokemontcg";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

/** MSRP-style reference prices (USD) per category. Sellers set real prices. */
const REF_PRICES: Record<string, { min: number; avg: number; max: number }> = {
  booster_pack: { min: 3.99, avg: 4.49, max: 5.99 },
  booster_box: { min: 129.99, avg: 143.64, max: 179.99 },
  etb: { min: 44.99, avg: 49.99, max: 59.99 },
  blister: { min: 11.99, avg: 12.99, max: 15.99 },
  collector_box: { min: 24.99, avg: 29.99, max: 39.99 },
  tin: { min: 21.99, avg: 24.99, max: 29.99 },
  sleeves: { min: 7.99, avg: 9.99, max: 14.99 },
  deck_box: { min: 4.99, avg: 7.99, max: 24.99 },
  playmat: { min: 14.99, avg: 19.99, max: 34.99 },
  binder_portfolio: { min: 12.99, avg: 19.99, max: 39.99 },
  damage_counter: { min: 4.99, avg: 6.99, max: 9.99 },
};

const ACCESSORIES: Array<{ name: string; category: keyof typeof REF_PRICES; description: string }> = [
  { name: "Ultra Pro Eclipse Matte Sleeves (100ct)", category: "sleeves", description: "Premium matte card sleeves, standard size, 100 count." },
  { name: "Dragon Shield Matte Sleeves (100ct)", category: "sleeves", description: "Tournament-grade matte sleeves with high shuffle feel." },
  { name: "Ultra Pro Deck Box 80+", category: "deck_box", description: "Holds 80 sleeved cards, snap closure." },
  { name: "Ultimate Guard Boulder 100+", category: "deck_box", description: "Rugged deck box for 100 double-sleeved cards." },
  { name: "Pokémon TCG Official Playmat", category: "playmat", description: "Official stitched-edge playmat with zone layout." },
  { name: "Acrylic Damage Counter Set", category: "damage_counter", description: "Acrylic damage counters + poison/burn markers + coin." },
  { name: "9-Pocket Premium Binder (360 cards)", category: "binder_portfolio", description: "Side-loading zippered binder, 360-card capacity." },
  { name: "4-Pocket Mini Binder (160 cards)", category: "binder_portfolio", description: "Compact side-loading binder for trade stock." },
];

let seedPromise: Promise<void> | null = null;

/** Ensures the catalog is populated. Runs at most once per process. */
export function ensureProductsSeeded(): Promise<void> {
  if (!seedPromise) seedPromise = seed().catch((err) => {
    console.warn("[seedProducts] failed:", err);
    seedPromise = null; // allow retry on next call
  });
  return seedPromise;
}

async function seed(): Promise<void> {
  const existing = await countProducts();
  // Re-run cheaply: upserts are idempotent, but skip entirely when the
  // catalog already has plenty of rows and the newest set is present.
  const sets = (await getSets()).slice(0, 12);

  if (existing > 0 && sets.length > 0) {
    // quick freshness check — newest set's booster box already there?
    // (upsertProductBySlug is a no-op for existing slugs, so just proceed
    // with the newest 3 sets to pick up new releases without full re-scan)
    for (const set of sets.slice(0, 3)) await seedSet(set);
    return;
  }

  for (const set of sets) await seedSet(set);

  for (const acc of ACCESSORIES) {
    const ref = REF_PRICES[acc.category];
    await upsertProductBySlug({
      name: acc.name,
      slug: slugify(acc.name),
      description: acc.description,
      imageUrl: null,
      category: acc.category as never,
      language: "English",
      setId: null,
      setName: null,
      minPriceUsd: ref.min.toFixed(2),
      avgPriceUsd: ref.avg.toFixed(2),
      maxPriceUsd: ref.max.toFixed(2),
    });
  }
}

async function seedSet(set: { id: string; name: string; series: string; releaseDate: string; images: { logo: string; symbol: string } }) {
  const variants: Array<{ suffix: string; category: keyof typeof REF_PRICES; description: string }> = [
    { suffix: "Booster Box (36 packs)", category: "booster_box", description: `Factory-sealed booster box with 36 packs of ${set.name} (${set.series}).` },
    { suffix: "Elite Trainer Box", category: "etb", description: `Elite Trainer Box: 9 boosters, sleeves, dice, markers and guide for ${set.name}.` },
    { suffix: "Booster Pack", category: "booster_pack", description: `Single sealed booster pack of ${set.name} (10 cards).` },
    { suffix: "3-Pack Blister", category: "blister", description: `Checklane blister with 3 boosters + promo coin, ${set.name}.` },
  ];

  for (const v of variants) {
    const name = `${set.name} — ${v.suffix}`;
    const ref = REF_PRICES[v.category];
    await upsertProductBySlug({
      name,
      slug: slugify(`${set.id} ${v.suffix}`),
      description: v.description,
      imageUrl: set.images.logo,
      category: v.category as never,
      language: "English",
      setId: set.id,
      setName: set.name,
      minPriceUsd: ref.min.toFixed(2),
      avgPriceUsd: ref.avg.toFixed(2),
      maxPriceUsd: ref.max.toFixed(2),
    });
  }
}
