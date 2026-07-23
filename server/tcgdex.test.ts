import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPortugueseCard, searchPortugueseCards } from "./lib/tcgdex";

const fetchMock = vi.fn();

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe("TCGdex Portuguese catalog", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adapts Brazilian Portuguese cards and excludes TCG Pocket", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "sv08.5-025",
          localId: "025",
          name: "Pikachu",
          image: "https://assets.tcgdex.net/pt/sv/sv08.5/025",
        },
        {
          id: "tcgp-A1-001",
          localId: "001",
          name: "Bulbasaur",
          image: "https://assets.tcgdex.net/en/tcgp/A1/001",
        },
      ])
    );

    const result = await searchPortugueseCards({
      q: "Pikachu",
      page: 1,
      pageSize: 12,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "ptbr:sv08.5-025",
      name: "Pikachu",
      number: "025",
      images: {
        small: "https://assets.tcgdex.net/pt/sv/sv08.5/025/low.webp",
        large: "https://assets.tcgdex.net/pt/sv/sv08.5/025/high.webp",
      },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("name=like%3APikachu");
  });

  it("loads a Portuguese physical card with set metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "sv08.5-025",
        localId: "025",
        name: "Pikachu",
        image: "https://assets.tcgdex.net/pt/sv/sv08.5/025",
        category: "Pokémon",
        hp: 70,
        types: ["Elétrico"],
        rarity: "Rara",
        set: {
          id: "sv08.5",
          name: "Evoluções Prismáticas",
          cardCount: { official: 131, total: 180 },
        },
      })
    );

    await expect(getPortugueseCard("sv08.5-025")).resolves.toMatchObject({
      id: "ptbr:sv08.5-025",
      hp: "70",
      rarity: "Rara",
      set: {
        id: "ptbr:sv08.5",
        name: "Evoluções Prismáticas",
        printedTotal: 131,
        total: 180,
      },
    });
  });

  it("rejects unsafe card identifiers before calling the API", async () => {
    await expect(getPortugueseCard("../secret")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
