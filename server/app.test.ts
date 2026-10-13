import { describe, expect, it } from "vitest";
import {
  detectLocale,
  defaultCurrencyForLocale,
  normalizeVariant,
  SCANNER_QUOTAS,
} from "@shared/app";
import { convertFromUsd, fallbackFxRates, getFxRates } from "./lib/fx";
import {
  getAvailableVariants,
  getVariantPrice,
  type PtcgCard,
} from "./lib/pokemontcg";
import { consumeScannerQuota, dailyLimitFor } from "./scannerRoutes";
import { isKnownClientRoute, isPrivatePath } from "./seo";
import { safeNextPath } from "./_core/auth";

const card = {
  id: "sv3pt5-6",
  name: "Charizard ex",
  number: "6",
  supertype: "Pokémon",
  images: { small: "small", large: "large" },
  set: {
    id: "sv3pt5",
    name: "151",
    series: "Scarlet & Violet",
    ptcgoCode: "MEW",
    printedTotal: 165,
    total: 207,
    releaseDate: "2023/09/22",
    updatedAt: "2023/09/22",
    images: { symbol: "symbol", logo: "logo" },
  },
  tcgplayer: {
    url: "https://tcgplayer.com",
    updatedAt: "2026/10/01",
    prices: {
      normal: { low: 1, mid: 2, high: 4, market: 2.1, directLow: null },
      reverseHolofoil: { low: 5, mid: 9, high: 20, market: 9.5, directLow: null },
      holofoil: { low: 50, mid: 70, high: 120, market: 68, directLow: null },
    },
  },
} satisfies PtcgCard;

describe("locale and currency defaults", () => {
  it("detects Portuguese from any pt-* tag and falls back to English", () => {
    expect(detectLocale(["pt-BR", "en-US"])).toBe("pt-BR");
    expect(detectLocale(["pt"])).toBe("pt-BR");
    expect(detectLocale(["en-GB"])).toBe("en");
    expect(detectLocale(["ja-JP"])).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
  });

  it("defaults Brazilians to BRL and everyone else to USD", () => {
    expect(defaultCurrencyForLocale("pt-BR")).toBe("BRL");
    expect(defaultCurrencyForLocale("en")).toBe("USD");
  });
});

describe("variant normalisation and pricing", () => {
  it("maps the scanner's free text to a price bucket", () => {
    expect(normalizeVariant("Reverse Holo")).toBe("reverseHolofoil");
    expect(normalizeVariant("holofoil rare")).toBe("holofoil");
    expect(normalizeVariant("1st Edition Holo")).toBe("1stEditionHolofoil");
    expect(normalizeVariant("first edition")).toBe("1stEditionNormal");
    expect(normalizeVariant("Special Illustration Rare")).toBe("holofoil");
    expect(normalizeVariant("black star promo")).toBe("promo");
    expect(normalizeVariant(null)).toBe("normal");
  });

  it("never collapses a reverse holo into the holo price", () => {
    expect(getVariantPrice(card, "reverseHolofoil")).toMatchObject({
      bucket: "reverseHolofoil",
      exact: true,
      price: { market: 9.5 },
    });
    expect(getVariantPrice(card, "holofoil").price?.market).toBe(68);
    expect(getVariantPrice(card, "normal").price?.market).toBe(2.1);
  });

  it("falls back to a neighbouring bucket and reports it is not exact", () => {
    const result = getVariantPrice(card, "1stEditionHolofoil");
    expect(result.bucket).toBe("holofoil");
    expect(result.exact).toBe(false);
  });

  it("lists only the variants that carry a price", () => {
    expect(getAvailableVariants(card).sort()).toEqual(
      ["holofoil", "normal", "reverseHolofoil"].sort()
    );
    expect(getAvailableVariants({ ...card, tcgplayer: undefined })).toEqual([]);
  });
});

describe("fx rates", () => {
  it("converts and rounds to cents", () => {
    const rates = fallbackFxRates();
    expect(convertFromUsd(10, "BRL", rates)).toBe(55);
    expect(convertFromUsd(3.14159, "USD", rates)).toBe(3.14);
    expect(convertFromUsd(null, "BRL", rates)).toBeNull();
  });

  it("uses the live provider when it answers", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ date: "2026-10-13", rates: { BRL: 5.31 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    const rates = await getFxRates(fetchImpl);
    expect(rates.rates.BRL).toBe(5.31);
    expect(rates.source).toBe("frankfurter");
  });
});

describe("scanner quota tiers", () => {
  it("gives anonymous scans a smaller daily budget than accounts", () => {
    expect(dailyLimitFor("anonymous")).toBe(SCANNER_QUOTAS.anonymousPerDay);
    expect(dailyLimitFor("free")).toBe(SCANNER_QUOTAS.freePerDay);
    expect(dailyLimitFor("pro")).toBe(Number.POSITIVE_INFINITY);
  });

  it("caps an anonymous IP at its daily limit", () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    const subject = { key: `ip:${ip}-${Date.now()}`, tier: "anonymous" as const };
    let last: ReturnType<typeof consumeScannerQuota> | null = null;
    for (let i = 0; i < SCANNER_QUOTAS.anonymousPerDay; i++) {
      // Spread calls across minutes so the per-minute cap does not fire.
      last = consumeScannerQuota(subject, `${ip}-${i}`, new Date(2026, 9, 13, 12, i));
      expect(last.allowed).toBe(true);
    }
    const blocked = consumeScannerQuota(
      subject,
      `${ip}-x`,
      new Date(2026, 9, 13, 12, 40)
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(86_400);
  });

  it("keeps the legacy numeric signature working", () => {
    const result = consumeScannerQuota(424242, "198.51.100.9", new Date(2026, 9, 13));
    expect(result.allowed).toBe(true);
    expect(result.dailyLimit).toBe(SCANNER_QUOTAS.freePerDay);
  });
});

describe("app shell routing", () => {
  it("serves /app routes from the SPA and keeps them out of the index", () => {
    expect(isKnownClientRoute("/app")).toBe(true);
    expect(isKnownClientRoute("/app/scan")).toBe(true);
    expect(isKnownClientRoute("/app/collection/")).toBe(true);
    expect(isPrivatePath("/app/portfolio")).toBe(true);
    expect(isKnownClientRoute("/application")).toBe(false);
  });

  it("only honours same-origin paths after OAuth", () => {
    expect(safeNextPath("/app/scan")).toBe("/app/scan");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("/a\r\nSet-Cookie: x")).toBe("/");
  });
});
