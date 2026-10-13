import { describe, expect, it } from "vitest";
import type { PtcgCard } from "./lib/pokemontcg";
import { priceUpdatesFor } from "./binderPrices";

const card = {
  id: "sv3pt5-6",
  name: "Charizard ex",
  number: "6",
  supertype: "Pokémon",
  images: { small: "s", large: "l" },
  set: {
    id: "sv3pt5",
    name: "151",
    series: "SV",
    ptcgoCode: "MEW",
    printedTotal: 165,
    total: 207,
    releaseDate: "2023/09/22",
    updatedAt: "2023/09/22",
    images: { symbol: "", logo: "" },
  },
  tcgplayer: {
    url: "",
    updatedAt: "",
    prices: {
      normal: { low: 1, mid: 2, high: 3, market: 2.25, directLow: null },
      reverseHolofoil: { low: 5, mid: 8, high: 12, market: 9.1, directLow: null },
    },
  },
} satisfies PtcgCard;

describe("collection price refresh", () => {
  it("prices each (card, variant) pair with its own bucket", () => {
    const { updates, missing } = priceUpdatesFor(
      [card],
      [
        { cardId: "sv3pt5-6", variant: "normal" },
        { cardId: "sv3pt5-6", variant: "reverseHolofoil" },
        { cardId: "gone-1", variant: "normal" },
      ]
    );
    expect(missing).toBe(1);
    expect(updates).toEqual([
      { cardId: "sv3pt5-6", variant: "normal", priceUsd: "2.25" },
      { cardId: "sv3pt5-6", variant: "reverseHolofoil", priceUsd: "9.10" },
    ]);
  });

  it("stores null when the card has no price at all", () => {
    const { updates } = priceUpdatesFor(
      [{ ...card, tcgplayer: undefined }],
      [{ cardId: "sv3pt5-6", variant: "holofoil" }]
    );
    expect(updates[0].priceUsd).toBeNull();
  });
});
