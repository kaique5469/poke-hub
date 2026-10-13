/**
 * Shared constants for the mobile-first app shell (`/app/*`).
 * Kept framework-free so both the server and the client can import it.
 */

export const APP_LOCALES = ["pt-BR", "en"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export const APP_CURRENCIES = ["USD", "BRL"] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];
export const DEFAULT_CURRENCY: AppCurrency = "USD";

export function isAppLocale(value: unknown): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}

export function isAppCurrency(value: unknown): value is AppCurrency {
  return APP_CURRENCIES.includes(value as AppCurrency);
}

/** Picks the locale from a browser `navigator.languages`-style list. */
export function detectLocale(languages: readonly string[] | undefined) {
  for (const raw of languages ?? []) {
    const tag = raw.toLowerCase();
    if (tag.startsWith("pt")) return "pt-BR" as const;
    if (tag.startsWith("en")) return "en" as const;
  }
  return DEFAULT_LOCALE;
}

/** Brazilians default to BRL; everyone else sees USD until they change it. */
export function defaultCurrencyForLocale(locale: AppLocale): AppCurrency {
  return locale === "pt-BR" ? "BRL" : "USD";
}

/**
 * Printed variants of a Pokémon card. Mirrors the TCGplayer price keys so a
 * variant maps 1:1 to a price bucket. `promo` has no TCGplayer bucket of its
 * own and falls back to the best available price.
 */
export const CARD_VARIANTS = [
  "normal",
  "holofoil",
  "reverseHolofoil",
  "1stEditionHolofoil",
  "1stEditionNormal",
  "promo",
] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export function isCardVariant(value: unknown): value is CardVariant {
  return CARD_VARIANTS.includes(value as CardVariant);
}

/** Maps the free-text variant the scanner reads off the card to a bucket. */
export function normalizeVariant(raw: string | null | undefined): CardVariant {
  const v = (raw ?? "").toLowerCase();
  if (!v) return "normal";
  const first = /1st|first/.test(v);
  if (/reverse/.test(v)) return "reverseHolofoil";
  if (/promo/.test(v)) return "promo";
  if (/holo|foil|shiny|rainbow|gold|full ?art|alt ?art|illustration|secret/.test(v)) {
    return first ? "1stEditionHolofoil" : "holofoil";
  }
  return first ? "1stEditionNormal" : "normal";
}

/** Card conditions, shared by binder, listings and the scanner review sheet. */
export const CARD_CONDITIONS = ["M", "NM", "SP", "MP", "HP", "D"] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

/**
 * Scanner quotas. Anonymous scans are allowed so the first scan happens
 * before any sign-up; limits exist to cap the per-scan AI cost, not to
 * upsell. Values are per UTC day.
 */
export const SCANNER_QUOTAS = {
  anonymousPerDay: 20,
  freePerDay: 100,
  proPerDay: Number.POSITIVE_INFINITY,
  perMinutePerIp: 6,
} as const;

/** Local storage keys used by the app shell (kept here to avoid typos). */
export const APP_STORAGE_KEYS = {
  locale: "rg.app.locale",
  currency: "rg.app.currency",
  pendingCollection: "rg.app.pendingCollection",
  recentScans: "rg.app.recentScans",
  gridDensity: "rg.app.gridDensity",
} as const;

/** An item scanned before sign-in, waiting to be merged into the binder. */
export type PendingCollectionItem = {
  localId: string;
  cardId: string;
  cardName: string;
  setId?: string;
  setName?: string;
  imageUrl?: string;
  rarity?: string;
  variant: CardVariant;
  condition: CardCondition;
  quantity: number;
  purchasePriceUsd?: number;
  language?: string;
  priceUsd?: number | null;
  createdAt: string;
};

/* ─── Pro plan ─────────────────────────────────────────────────────────── */

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const PRO_INTERVALS = ["month", "year"] as const;
export type ProInterval = (typeof PRO_INTERVALS)[number];

/**
 * Display prices per currency. The Stripe Price objects (env
 * STRIPE_PRO_PRICE_*) must match these; they are repeated here so the
 * paywall can render before Stripe is configured and in both currencies.
 */
export const PRO_PRICES: Record<AppCurrency, Record<ProInterval, number>> = {
  USD: { month: 4.99, year: 39.99 },
  BRL: { month: 14.9, year: 119 },
};

/** What Pro unlocks, in the order the paywall lists them. */
export const PRO_FEATURES = [
  "Unlimited scans",
  "Full price history",
  "Export your collection (CSV)",
  "Instant restock push",
  "Priority support",
] as const;

/** Free users see this many days of portfolio history. */
export const FREE_HISTORY_DAYS = 30;

export function isPro(user: {
  plan?: string | null;
  proUntil?: Date | string | null;
  role?: string | null;
} | null | undefined, now = new Date()) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.plan !== "pro") return false;
  if (!user.proUntil) return true;
  const until = new Date(user.proUntil);
  // A short grace window covers webhook delays around renewal.
  return until.getTime() + 3 * 86_400_000 > now.getTime();
}
