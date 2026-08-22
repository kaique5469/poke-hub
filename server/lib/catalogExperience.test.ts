import { describe, expect, it } from "vitest";
import {
  correctSearchText,
  findBestSetMatch,
  searchCoreTerms,
} from "./searchRelevance";
import {
  getHistoricCard,
  getHistoricPsaComps,
  searchHistoricCards,
} from "./historicCards";
import { extractPsaComps } from "./tcgPriceLookup";
import {
  isPublicEditorialArticle,
  stripGeneratedSourceSection,
  validateEditorialSources,
} from "./articleQuality";

describe("catalog search experience", () => {
  it("corrects common collector typos and product aliases", () => {
    expect(correctSearchText("Pikachu Ilustrator")).toBe("pikachu illustrator");
    expect(correctSearchText("Cause Rising ETB")).toBe(
      "chaos rising elite trainer box"
    );
    expect(searchCoreTerms("Cause Rising ETB")).toBe("chaos rising");
  });

  it("matches a misspelled set without requiring an exact name", () => {
    const match = findBestSetMatch("Cause Rising", [
      { id: "me-chaos", name: "Chaos Rising", ptcgoCode: "CRI" },
      { id: "sv-paldea", name: "Paldea Evolved", ptcgoCode: "PAL" },
    ]);
    expect(match?.set.id).toBe("me-chaos");
  });

  it("keeps a verified Pikachu Illustrator record searchable", () => {
    const [record] = searchHistoricCards("Pikachu Ilustrator");
    expect(record?.id).toBe("historic:pikachu-illustrator-1998");
    expect(getHistoricCard(record.id)?.artist).toBe("Atsuko Nishida");
    expect(getHistoricPsaComps(record.id)[0]).toMatchObject({
      grade: 10,
      value: 16_492_000,
      basis: "last_public_auction",
    });
  });
});

describe("graded price grounding", () => {
  it("returns only grades with observed sold data", () => {
    const result = extractPsaComps({
      id: "card-1",
      name: "Example",
      updated_at: "2026-08-21T10:00:00Z",
      prices: {
        graded: {
          psa: {
            "10": { ebay: { avg_7d: 418.5 }, sample_size: 4 },
            "9": { ebay: { avg_30d: 119.5 } },
            "8": { ebay: {} },
          },
        },
      },
    });
    expect(result.map(row => row.grade)).toEqual([10, 9]);
    expect(result[0]).toMatchObject({ value: 418.5, basis: "ebay_7d" });
  });
});

describe("verified editorial gate", () => {
  it("requires two HTTPS sources and a primary source", () => {
    expect(
      validateEditorialSources([
        { title: "Video", url: "https://youtube.com/watch?v=fake" },
      ]).valid
    ).toBe(false);
    expect(
      validateEditorialSources([
        {
          title: "Official announcement",
          url: "https://www.pokemon.com/us/pokemon-news/example",
        },
        {
          title: "Tournament data",
          url: "https://limitlesstcg.com/tournaments/example",
        },
      ]).valid
    ).toBe(true);
  });

  it("removes generated source duplication and quarantines known fake topics", () => {
    expect(stripGeneratedSourceSection("Body\n\n## Sources\n- old")).toBe(
      "Body"
    );
    expect(
      isPublicEditorialArticle({ title: "Elements Unleashed Set Revealed" })
    ).toBe(false);
    expect(
      isPublicEditorialArticle({ title: "Official August 2026 Product Guide" })
    ).toBe(true);
  });
});
