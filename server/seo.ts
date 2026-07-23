import type { Express } from "express";
import { getPublishedArticleSitemapRows } from "./db";
import { getIndexableProductSitemapRows } from "./marketplaceDb";
import { getSets } from "./lib/pokemontcg";

export const SITE_URL = "https://raritygrid.com";
export const SITE_NAME = "RarityGrid";

const PRIVATE_PATHS = [
  /^\/login\/?$/,
  /^\/account(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/binder(?:\/|$)/,
  /^\/cart(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/open-store(?:\/|$)/,
  /^\/orders(?:\/|$)/,
  /^\/scanner(?:\/|$)/,
  /^\/profile\/edit\/?$/,
  /^\/sell(?:-card)?\/?$/,
];

const CLIENT_ROUTES = [
  /^\/$/,
  /^\/(?:login|cards|scanner|market|sets|game|weekly-rules|pokedex|metagame|decks|deck-builder|community|tournaments|binder|drops|shop|marketplace|cart|orders|auctions|bazaar|articles|sell|sell-card|open-store|dashboard|account|privacy|terms|contact|404)\/?$/,
  /^\/(?:cards|sets|pokedex|shop|articles|store|profile)\/[^/]+\/?$/,
  /^\/admin\/(?:escrow|game)\/?$/,
  /^\/decks\/builder\/?$/,
];

type RouteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
};

const PAGE_META: Record<string, Omit<RouteSeo, "canonicalPath">> = {
  "/": {
    title: "RarityGrid — Pokémon Card Prices, Sets & Marketplace",
    description:
      "Track English Pokémon card prices in USD, explore every TCG set, discover market trends and shop real listings from collectors and trusted stores.",
  },
  "/cards": {
    title: "Pokémon Card Database & USD Prices — RarityGrid",
    description:
      "Search English Pokémon TCG cards by name, set and rarity, then compare current USD market references and available listings.",
  },
  "/sets": {
    title: "All Pokémon TCG Sets & Expansions — RarityGrid",
    description:
      "Browse Pokémon TCG expansions with release dates, complete card lists, sealed products and market highlights.",
  },
  "/shop": {
    title: "Pokémon TCG Marketplace & Sealed Products — RarityGrid",
    description:
      "Shop real Pokémon TCG listings, including booster boxes, Elite Trainer Boxes, bundles and collector products in USD.",
  },
  "/market": {
    title: "Pokémon Card Market Trends & Price Movers — RarityGrid",
    description:
      "Follow verified Pokémon card price observations, collector demand and marketplace activity without manufactured market claims.",
  },
  "/articles": {
    title: "Pokémon TCG News, Guides & Collector Articles — RarityGrid",
    description:
      "Read Pokémon TCG set reviews, market analysis, strategy guides and practical collector news from RarityGrid.",
  },
  "/pokedex": {
    title: "Complete National Pokédex — RarityGrid",
    description:
      "Explore all 1,025 Pokémon by generation and type, with official Pokédex data, stats and related cards.",
  },
  "/decks": {
    title: "Pokémon TCG Decks & Deck Builder — RarityGrid",
    description:
      "Browse community Pokémon TCG decklists and build, organize and share your own competitive decks.",
  },
  "/metagame": {
    title: "Pokémon TCG Metagame & Top Decks — RarityGrid",
    description:
      "Explore current Pokémon TCG tournament archetypes, top decks and competitive metagame results.",
  },
  "/tournaments": {
    title: "Pokémon TCG Tournaments — RarityGrid",
    description:
      "Discover Pokémon TCG tournament information, competitive results and community events.",
  },
  "/game": {
    title: "Guess the Pokémon Game — RarityGrid",
    description:
      "Play Guess the Pokémon in easy, medium or hard mode, earn points and test your Pokédex knowledge.",
  },
  "/weekly-rules": {
    title: "Weekly Arena Rules & Active Prize — RarityGrid",
    description:
      "View the active RarityGrid Weekly Arena prize, eligibility, verified scoring, tie-break and claim rules.",
  },
};

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/"))
    return pathname.slice(0, -1);
  return pathname;
}

export function isKnownClientRoute(pathname: string) {
  return CLIENT_ROUTES.some(pattern => pattern.test(pathname));
}

export function isPrivatePath(pathname: string) {
  return PRIVATE_PATHS.some(pattern => pattern.test(pathname));
}

export function getRouteSeo(pathname: string, status = 200): RouteSeo {
  const path = normalizePath(pathname);
  const exact = PAGE_META[path];
  if (exact) return { ...exact, canonicalPath: path || "/" };

  let title = "Pokémon TCG Cards, Prices & Marketplace — RarityGrid";
  let description =
    "Explore English Pokémon TCG cards, sets, USD price references, collector tools and real marketplace listings on RarityGrid.";

  if (/^\/cards\/[^/]+$/.test(path)) {
    title = "Pokémon Card Details & Price History — RarityGrid";
    description =
      "View this Pokémon card's set details, printings, verified USD price references, market history and available seller listings.";
  } else if (/^\/sets\/[^/]+$/.test(path)) {
    title = "Pokémon TCG Set Card List & Products — RarityGrid";
    description =
      "Explore this Pokémon TCG expansion's complete card list, sealed products, release information and market highlights.";
  } else if (/^\/shop\/[^/]+$/.test(path)) {
    title = "Pokémon TCG Product & Seller Listings — RarityGrid";
    description =
      "View verified details, real seller listings and USD price references for this Pokémon TCG product.";
  } else if (/^\/articles\/[^/]+$/.test(path)) {
    title = "Pokémon TCG Article — RarityGrid";
    description =
      "Read Pokémon TCG news, collector analysis, set reviews and strategy from RarityGrid.";
  } else if (/^\/pokedex\/[^/]+$/.test(path)) {
    title = "Pokémon Pokédex Entry, Stats & Cards — RarityGrid";
    description =
      "View this Pokémon's National Pokédex data, type, stats, abilities and related Pokémon TCG cards.";
  }

  const noIndex = status === 404 || isPrivatePath(path) || path === "/404";
  return { title, description, canonicalPath: path || "/", noIndex };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectSeoMetadata(
  html: string,
  pathname: string,
  status = 200
) {
  const meta = getRouteSeo(pathname, status);
  const canonical = `${SITE_URL}${meta.canonicalPath === "/" ? "/" : meta.canonicalPath}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const robots = meta.noIndex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  let output = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${description}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonical}" />`
    );

  if (/<meta\s+name="robots"/i.test(output)) {
    output = output.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${robots}" />`
    );
  } else {
    output = output.replace(
      "</head>",
      `    <meta name="robots" content="${robots}" />\n  </head>`
    );
  }
  return output;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

type SitemapEntry = {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
};

const STATIC_SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: 1 },
  { path: "/cards", changefreq: "daily", priority: 0.9 },
  { path: "/sets", changefreq: "daily", priority: 0.9 },
  { path: "/shop", changefreq: "daily", priority: 0.9 },
  { path: "/market", changefreq: "daily", priority: 0.8 },
  { path: "/articles", changefreq: "daily", priority: 0.8 },
  { path: "/pokedex", changefreq: "weekly", priority: 0.8 },
  { path: "/decks", changefreq: "daily", priority: 0.7 },
  { path: "/metagame", changefreq: "daily", priority: 0.7 },
  { path: "/tournaments", changefreq: "daily", priority: 0.7 },
  { path: "/auctions", changefreq: "daily", priority: 0.7 },
  { path: "/bazaar", changefreq: "daily", priority: 0.7 },
  { path: "/community", changefreq: "daily", priority: 0.6 },
  { path: "/game", changefreq: "weekly", priority: 0.6 },
  { path: "/weekly-rules", changefreq: "weekly", priority: 0.5 },
  { path: "/drops", changefreq: "daily", priority: 0.6 },
  { path: "/privacy", changefreq: "monthly", priority: 0.2 },
  { path: "/terms", changefreq: "monthly", priority: 0.2 },
  { path: "/contact", changefreq: "monthly", priority: 0.3 },
];

function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries
    .map(entry => {
      const loc = `${SITE_URL}${entry.path === "/" ? "/" : entry.path}`;
      const lastmod = entry.lastmod
        ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>`
        : "";
      const changefreq = entry.changefreq
        ? `<changefreq>${entry.changefreq}</changefreq>`
        : "";
      const priority =
        entry.priority === undefined
          ? ""
          : `<priority>${entry.priority.toFixed(1)}</priority>`;
      return `  <url><loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

let sitemapCache: { xml: string; expiresAt: number } | undefined;

async function buildSitemap() {
  const now = Date.now();
  if (sitemapCache && sitemapCache.expiresAt > now) return sitemapCache.xml;

  const [setsResult, productsResult, articlesResult] = await Promise.allSettled(
    [
      getSets(),
      getIndexableProductSitemapRows(),
      getPublishedArticleSitemapRows(),
    ]
  );
  const entries = [...STATIC_SITEMAP_ENTRIES];

  if (setsResult.status === "fulfilled") {
    for (const set of setsResult.value) {
      entries.push({
        path: `/sets/${encodeURIComponent(set.id)}`,
        lastmod: xmlDate(set.updatedAt),
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  }
  if (productsResult.status === "fulfilled") {
    for (const product of productsResult.value) {
      entries.push({
        path: `/shop/${encodeURIComponent(product.slug)}`,
        lastmod: xmlDate(product.updatedAt),
        changefreq: "weekly",
        priority: 0.7,
      });
    }
  }
  if (articlesResult.status === "fulfilled") {
    for (const article of articlesResult.value) {
      entries.push({
        path: `/articles/${encodeURIComponent(article.slug)}`,
        lastmod: xmlDate(article.updatedAt ?? article.publishedAt),
        changefreq: "monthly",
        priority: 0.7,
      });
    }
  }
  for (let id = 1; id <= 1025; id += 1) {
    entries.push({
      path: `/pokedex/${id}`,
      changefreq: "monthly",
      priority: 0.5,
    });
  }

  const xml = renderSitemap(entries);
  sitemapCache = { xml, expiresAt: now + 60 * 60 * 1_000 };
  return xml;
}

export function registerSeoRoutes(app: Express) {
  app.use((req, res, next) => {
    const host = req.hostname.toLowerCase();
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      (host.endsWith(".up.railway.app") || host === "www.raritygrid.com")
    ) {
      return res.redirect(301, `${SITE_URL}${req.originalUrl}`);
    }
    next();
  });

  app.get("/marketplace", (_req, res) => res.redirect(301, `${SITE_URL}/shop`));
  app.get("/deck-builder", (_req, res) =>
    res.redirect(301, `${SITE_URL}/decks/builder`)
  );

  app.get("/robots.txt", (_req, res) => {
    res
      .type("text/plain")
      .set("Cache-Control", "public, max-age=3600")
      .send(
        [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin/",
          "Disallow: /account",
          "Disallow: /binder",
          "Disallow: /cart",
          "Disallow: /dashboard",
          "Disallow: /login",
          "Disallow: /orders",
          "Disallow: /profile/edit",
          "Disallow: /sell",
          "",
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          "",
        ].join("\n")
      );
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const xml = await buildSitemap();
      res
        .type("application/xml")
        .set(
          "Cache-Control",
          "public, max-age=3600, stale-while-revalidate=86400"
        )
        .send(xml);
    } catch (error) {
      console.error("[SEO] Failed to build sitemap:", error);
      res.status(500).type("text/plain").send("Unable to build sitemap");
    }
  });
}
