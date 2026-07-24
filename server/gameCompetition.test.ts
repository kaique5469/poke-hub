import { describe, expect, it } from "vitest";
import {
  DAILY_SCORED_WIN_LIMIT,
  ELIGIBLE_PRIZE_COUNTRIES,
  ELIGIBLE_PRIZE_COUNTRY_VALUE,
  getWeekWindow,
  isValidPrizePostalCode,
} from "./gameCompetitionDb";

describe("weekly game competition", () => {
  it("uses a stable Monday-to-Monday São Paulo window", () => {
    const monday = getWeekWindow(new Date("2026-07-20T10:00:00.000Z"));
    const sunday = getWeekWindow(new Date("2026-07-27T02:59:59.000Z"));
    expect(monday.weekKey).toBe("2026-07-20");
    expect(sunday.weekKey).toBe(monday.weekKey);
    expect(monday.startsAt.toISOString()).toBe("2026-07-20T03:00:00.000Z");
    expect(monday.endsAt.toISOString()).toBe("2026-07-27T03:00:00.000Z");
  });

  it("moves the next Monday into a new ranking", () => {
    expect(getWeekWindow(new Date("2026-07-27T03:00:00.000Z")).weekKey).toBe(
      "2026-07-27"
    );
  });

  it("caps daily scored wins for fair participation", () => {
    expect(DAILY_SCORED_WIN_LIMIT).toBe(10);
  });

  it("supports authorized prize delivery in Brazil and the United States", () => {
    expect(ELIGIBLE_PRIZE_COUNTRIES).toEqual(["BR", "US"]);
    expect(ELIGIBLE_PRIZE_COUNTRY_VALUE).toBe("BR,US");
    expect(isValidPrizePostalCode("BR", "01310-100")).toBe(true);
    expect(isValidPrizePostalCode("BR", "01310100")).toBe(true);
    expect(isValidPrizePostalCode("US", "10001")).toBe(true);
    expect(isValidPrizePostalCode("US", "10001-1234")).toBe(true);
    expect(isValidPrizePostalCode("BR", "10001")).toBe(false);
    expect(isValidPrizePostalCode("US", "01310-100")).toBe(false);
  });
});
