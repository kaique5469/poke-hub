export const DROP_RETAILERS = [
  "walmart",
  "target",
  "pokemon_center",
  "amazon",
  "best_buy",
  "gamestop",
  "costco",
  "sams_club",
  "barnes_noble",
  "bjs",
  "meijer",
  "scheels",
  "walgreens",
  "cvs",
  "dollar_general",
  "five_below",
  "amazon_br",
  "mercado_livre",
  "copag",
  "ri_happy",
  "pbkids",
  "liga_pokemon",
  "epic_game",
  "gamenerdz",
  "smoke_mirrors",
  "forge_fire",
  "safari_zone",
  "tcgplayer",
  "ebay",
] as const;

export type DropRetailer = (typeof DROP_RETAILERS)[number];

export const DROP_RETAILER_META: Record<
  DropRetailer,
  {
    name: string;
    domain: string;
    color: string;
    currency?: "USD" | "BRL";
    timezone?: string;
  }
> = {
  walmart: {
    name: "Walmart",
    domain: "walmart.com",
    color: "#087ea4",
  },
  target: {
    name: "Target",
    domain: "target.com",
    color: "#cc0000",
  },
  pokemon_center: {
    name: "Pokémon Center",
    domain: "pokemoncenter.com",
    color: "#f4c430",
  },
  amazon: {
    name: "Amazon",
    domain: "amazon.com",
    color: "#ff9900",
  },
  best_buy: {
    name: "Best Buy",
    domain: "bestbuy.com",
    color: "#fff200",
  },
  gamestop: {
    name: "GameStop",
    domain: "gamestop.com",
    color: "#ef4444",
  },
  costco: {
    name: "Costco",
    domain: "costco.com",
    color: "#2563eb",
  },
  sams_club: {
    name: "Sam's Club",
    domain: "samsclub.com",
    color: "#38bdf8",
  },
  barnes_noble: {
    name: "Barnes & Noble",
    domain: "barnesandnoble.com",
    color: "#16a34a",
  },
  bjs: {
    name: "BJ's Wholesale",
    domain: "bjs.com",
    color: "#dc2626",
  },
  meijer: {
    name: "Meijer",
    domain: "meijer.com",
    color: "#ef4444",
  },
  scheels: {
    name: "SCHEELS",
    domain: "scheels.com",
    color: "#dc2626",
  },
  walgreens: {
    name: "Walgreens",
    domain: "walgreens.com",
    color: "#dc2626",
  },
  cvs: {
    name: "CVS Pharmacy",
    domain: "cvs.com",
    color: "#ef4444",
  },
  dollar_general: {
    name: "Dollar General",
    domain: "dollargeneral.com",
    color: "#facc15",
  },
  five_below: {
    name: "Five Below",
    domain: "fivebelow.com",
    color: "#22d3ee",
  },
  amazon_br: {
    name: "Amazon Brasil",
    domain: "amazon.com.br",
    color: "#ff9900",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  mercado_livre: {
    name: "Mercado Livre",
    domain: "mercadolivre.com.br",
    color: "#ffe600",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  copag: {
    name: "Loja Copag",
    domain: "copagloja.com.br",
    color: "#2563eb",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  ri_happy: {
    name: "Ri Happy",
    domain: "rihappy.com.br",
    color: "#f97316",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  pbkids: {
    name: "PBKids",
    domain: "pbkids.com.br",
    color: "#ec4899",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  liga_pokemon: {
    name: "Liga Pokémon",
    domain: "ligapokemon.com.br",
    color: "#7c3aed",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  epic_game: {
    name: "Epic Game",
    domain: "epicgame.com.br",
    color: "#dc2626",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  gamenerdz: {
    name: "Game Nerdz",
    domain: "gamenerdz.com",
    color: "#8b5cf6",
  },
  smoke_mirrors: {
    name: "Smoke & Mirrors Hobby",
    domain: "smokeandmirrorshobby.com",
    color: "#94a3b8",
  },
  forge_fire: {
    name: "Forge & Fire Gaming",
    domain: "forgeandfiregaming.com",
    color: "#f97316",
  },
  safari_zone: {
    name: "Safari Zone Collectibles",
    domain: "safari-zone.com",
    color: "#22c55e",
  },
  tcgplayer: {
    name: "TCGplayer",
    domain: "tcgplayer.com",
    color: "#2563eb",
  },
  ebay: {
    name: "eBay",
    domain: "ebay.com",
    color: "#eab308",
  },
};

export const DROP_RETAILER_GROUPS: Array<{
  label: string;
  retailers: DropRetailer[];
}> = [
  {
    label: "Major retailers",
    retailers: [
      "walmart",
      "target",
      "pokemon_center",
      "amazon",
      "best_buy",
      "gamestop",
    ],
  },
  {
    label: "Warehouse & regional",
    retailers: [
      "costco",
      "sams_club",
      "bjs",
      "meijer",
      "barnes_noble",
      "scheels",
      "walgreens",
      "cvs",
      "dollar_general",
      "five_below",
    ],
  },
  {
    label: "TCG specialists",
    retailers: [
      "gamenerdz",
      "smoke_mirrors",
      "forge_fire",
      "safari_zone",
    ],
  },
  {
    label: "Brazil",
    retailers: [
      "amazon_br",
      "mercado_livre",
      "copag",
      "ri_happy",
      "pbkids",
      "liga_pokemon",
      "epic_game",
    ],
  },
  { label: "Marketplaces", retailers: ["tcgplayer", "ebay"] },
];

export function dropRetailerCurrency(retailer: DropRetailer) {
  return DROP_RETAILER_META[retailer].currency ?? "USD";
}

export function dropRetailerTimezone(retailer: DropRetailer) {
  return DROP_RETAILER_META[retailer].timezone ?? "America/New_York";
}

export const DROP_STOCK_STATES = [
  "unknown",
  "out_of_stock",
  "in_stock",
  "preorder",
] as const;

export type DropStockState = (typeof DROP_STOCK_STATES)[number];
export type DropMonitorMode = "always" | "release_windows";
export type DropEventType = "new_product" | "restock" | "preorder";

export type DropProviderProduct = {
  retailer: DropRetailer;
  retailerProductId: string;
  title: string;
  productUrl: string;
  imageUrl?: string | null;
  stockState: DropStockState;
  priceCents?: number | null;
  currency?: "USD" | "BRL" | null;
  observedAt: Date;
  source: string;
};

export type DropProviderPayload = {
  products: DropProviderProduct[];
  requestId?: string;
};

export const DEFAULT_RELEASE_WINDOWS: Array<{
  retailer: DropRetailer;
  label: string;
  timezone: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  burstIntervalSeconds: number;
}> = [
  {
    retailer: "walmart",
    label: "Wednesday evening watch",
    timezone: "America/New_York",
    weekday: 3,
    startMinute: 20 * 60 + 55,
    endMinute: 21 * 60 + 15,
    burstIntervalSeconds: 5,
  },
];

export function isDropRetailer(value: string): value is DropRetailer {
  return (DROP_RETAILERS as readonly string[]).includes(value);
}

export function isDropStockState(value: string): value is DropStockState {
  return (DROP_STOCK_STATES as readonly string[]).includes(value);
}

export function normalizeProductUrl(
  retailer: DropRetailer,
  rawUrl: string
): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    const expected = DROP_RETAILER_META[retailer].domain;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== expected && !host.endsWith(`.${expected}`)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        [
          "aff",
          "affiliate",
          "ascsubtag",
          "athbdg",
          "athcgid",
          "athcpid",
          "athpgid",
          "campid",
          "clkid",
          "customid",
          "irclickid",
          "linkcode",
          "mkcid",
          "mkevt",
          "mkrid",
          "ref",
          "ref_",
          "sourceid",
          "tag",
          "toolid",
        ].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function productMatchesQuery(title: string, query: string): boolean {
  const aliases: Record<string, string> = {
    etb: "elite trainer box",
    upc: "ultra premium collection",
    bb: "booster bundle",
  };
  const tokens = query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 1);
  if (!tokens.length) return false;
  const normalizedTitle = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ");
  return tokens.every(
    token =>
      normalizedTitle.includes(token) ||
      (aliases[token] ? normalizedTitle.includes(aliases[token]) : false)
  );
}
