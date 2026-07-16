import { describe, expect, it } from "vitest";
import {
  areArticleTitlesNearDuplicate,
  dedupeArticlesByTitle,
} from "./lib/articleQuality";
import { getRetailerLinks } from "./lib/retailerLinks";

describe("production-readiness helpers", () => {
  it("creates safe retailer search URLs from a verified product name", () => {
    const links = getRetailerLinks("Mega Evolution—Pitch Black Booster Bundle");
    expect(links).toHaveLength(4);
    expect(links.every(link => link.url.startsWith("https://"))).toBe(true);
    expect(links.find(link => link.id === "pokemon_center")?.url).toContain(
      "pitch-black-booster-bundle"
    );
    expect(links.find(link => link.id === "tcgplayer")?.url).toContain(
      "Pitch%20Black"
    );
  });

  it("hides near-duplicate editorial topics", () => {
    const first = "Pitch Black Pokémon TCG Set: Products and Release Guide";
    const second = "Pitch Black Set Release and Product Guide";
    expect(areArticleTitlesNearDuplicate(first, second)).toBe(true);
    expect(
      dedupeArticlesByTitle([{ title: first }, { title: second }])
    ).toHaveLength(1);
  });
});
