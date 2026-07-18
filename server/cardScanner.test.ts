import { describe, expect, it } from "vitest";
import type { PtcgCard } from "./lib/pokemontcg";
import {
  confirmScannerMatches,
  scoreCanonicalCard,
  type ScannerAnalysis,
} from "./cardScanner";
import { consumeScannerQuota } from "./scannerRoutes";

const analysis: ScannerAnalysis = {
  isPokemonCard: true,
  name: "Charizard ex",
  collectorNumber: "006",
  printedTotal: 165,
  setName: "151",
  setCode: "MEW",
  languageCode: "EN",
  variant: "double rare",
  graded: false,
  gradingCompany: null,
  grade: null,
  certificationNumber: null,
  confidence: 0.96,
  notes: "Clear front image",
};

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
} satisfies PtcgCard;

describe("card scanner canonical confirmation", () => {
  it("strongly scores exact name, number, set total and code", () => {
    expect(scoreCanonicalCard(card, analysis)).toBe(100);
  });

  it("does not treat a name-only mismatch as a safe catalog match", () => {
    expect(
      scoreCanonicalCard(
        { ...card, name: "Blastoise ex", number: "200" },
        analysis
      )
    ).toBeLessThan(30);
  });

  it("never queries the catalog for a non-Pokémon image", async () => {
    await expect(
      confirmScannerMatches({ ...analysis, isPokemonCard: false })
    ).resolves.toEqual([]);
  });
});

describe("scanner launch quota", () => {
  it("allows ten daily scans and blocks the eleventh", () => {
    const userId = 987_654;
    for (let index = 0; index < 10; index += 1) {
      expect(
        consumeScannerQuota(
          userId,
          `quota-test-${index}`,
          new Date(`2026-07-18T${String(index).padStart(2, "0")}:00:00.000Z`)
        ).allowed
      ).toBe(true);
    }
    expect(
      consumeScannerQuota(
        userId,
        "quota-test-final",
        new Date("2026-07-18T12:00:00.000Z")
      )
    ).toMatchObject({ allowed: false, retryAfter: 86_400 });
  });

  it("blocks a fourth scan from the same IP within a minute", () => {
    const now = new Date("2026-07-18T11:00:00.000Z");
    for (let index = 0; index < 3; index += 1) {
      expect(
        consumeScannerQuota(880_000 + index, "burst-test", now).allowed
      ).toBe(true);
    }
    expect(consumeScannerQuota(880_004, "burst-test", now)).toMatchObject({
      allowed: false,
      retryAfter: 60,
    });
  });

  it("resets the remaining daily allowance on a new UTC day", () => {
    const userId = 770_001;
    consumeScannerQuota(
      userId,
      "day-reset-before",
      new Date("2026-07-18T23:59:00.000Z")
    );
    expect(
      consumeScannerQuota(
        userId,
        "day-reset-after",
        new Date("2026-07-19T00:01:00.000Z")
      )
    ).toMatchObject({ allowed: true, remaining: 9 });
  });
});
