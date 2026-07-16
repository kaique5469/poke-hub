import { describe, expect, it } from "vitest";
import { selectComparableMarketSeries } from "./marketPulseDb";

describe("Market Pulse comparison integrity", () => {
  const observation = (source: string, variant: string, price: number) => ({
    source,
    variant,
    condition: "NM",
    currency: "USD",
    price,
  });

  it("does not compare a fallback quote with a different source", () => {
    const history = [
      observation("Scrydex", "holofoil", 80),
      observation("Scrydex", "holofoil", 82),
      observation("TCGPlayer via Pokemon TCG API", "market", 74),
    ];

    expect(selectComparableMarketSeries(history)).toEqual([history[2]]);
  });

  it("resumes the original verified series when that source returns", () => {
    const history = [
      observation("Scrydex", "holofoil", 80),
      observation("TCGPlayer via Pokemon TCG API", "market", 74),
      observation("Scrydex", "holofoil", 83),
    ];

    expect(selectComparableMarketSeries(history)).toEqual([
      history[0],
      history[2],
    ]);
  });
});
