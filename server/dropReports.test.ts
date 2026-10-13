import { describe, expect, it } from "vitest";
import { productMatchesQuery } from "../shared/drops";
import {
  REPORTS_PER_DAY,
  consumeReportQuota,
  countryForRetailer,
  shouldHide,
} from "./dropReports";

describe("community stock reports", () => {
  it("maps retailers to the country of the feed", () => {
    expect(countryForRetailer("amazon_br")).toBe("BR");
    expect(countryForRetailer("liga_pokemon")).toBe("BR");
    expect(countryForRetailer("target")).toBe("US");
    expect(countryForRetailer("pokemon_center")).toBe("US");
  });

  it("hides a report after three disputes without a confirming majority", () => {
    expect(shouldHide(0, 2)).toBe(false);
    expect(shouldHide(0, 3)).toBe(true);
    expect(shouldHide(3, 3)).toBe(false);
    expect(shouldHide(5, 4)).toBe(false);
    expect(shouldHide(1, 4)).toBe(true);
  });

  it("caps reports per user per day", () => {
    const userId = 123_456;
    const day = new Date("2026-10-13T15:00:00Z");
    for (let i = 0; i < REPORTS_PER_DAY; i++) {
      expect(consumeReportQuota(userId, day)).toBe(true);
    }
    expect(consumeReportQuota(userId, day)).toBe(false);
    expect(consumeReportQuota(userId, new Date("2026-10-14T01:00:00Z"))).toBe(true);
  });

  it("matches a sighting to monitors by the monitor's search words", () => {
    expect(
      productMatchesQuery("Pokémon TCG Prismatic Evolutions Elite Trainer Box", "prismatic etb")
    ).toBe(true);
    expect(productMatchesQuery("Scarlet & Violet 151 Booster Bundle", "prismatic etb")).toBe(false);
  });
});
