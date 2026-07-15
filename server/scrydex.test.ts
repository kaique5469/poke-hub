import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllSealedProducts } from "./lib/scrydex";
import { mapScrydexProduct } from "./scrydexSync";

const sampleProduct = {
  id: "me1-s1",
  name: "Mega Evolution Booster Pack",
  type: "Booster Pack",
  description: "Each pack contains 10 cards.",
  language: "English",
  images: [{ type: "front", small: "small.webp", large: "large.webp" }],
  expansion: { id: "me1", name: "Mega Evolution", series: "Mega Evolution", language: "English" },
  variants: [{
    name: "normal",
    prices: [
      { type: "raw", currency: "USD", low: 6.5, market: 7.25 },
      { type: "graded", currency: "USD", low: 50, market: 75 },
    ],
  }],
};

describe("Scrydex sealed catalog", () => {
  beforeEach(() => {
    process.env.SCRYDEX_API_KEY = "test-api-key";
    process.env.SCRYDEX_TEAM_ID = "test-team";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SCRYDEX_API_KEY;
    delete process.env.SCRYDEX_TEAM_ID;
  });

  it("maps a real sealed product into the marketplace schema", () => {
    const mapped = mapScrydexProduct(sampleProduct);
    expect(mapped.slug).toBe("scrydex-me1-s1");
    expect(mapped.category).toBe("booster_pack");
    expect(mapped.imageUrl).toBe("large.webp");
    expect(mapped.setId).toBe("me1");
    expect(mapped.avgPriceUsd).toBe("7.25");
    expect(mapped.minPriceUsd).toBe("6.50");
    expect(mapped.maxPriceUsd).toBe("7.25");
  });

  it("classifies common sealed product types", () => {
    expect(mapScrydexProduct({ ...sampleProduct, id: "x-1", type: "Booster Box", name: "Test Booster Box" }).category).toBe("booster_box");
    expect(mapScrydexProduct({ ...sampleProduct, id: "x-2", type: "Elite Trainer Box", name: "Test ETB" }).category).toBe("etb");
    expect(mapScrydexProduct({ ...sampleProduct, id: "x-3", type: "Collection", name: "Charizard ex Collection" }).category).toBe("collector_box");
  });

  it("paginates with authenticated server-only headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", data: [sampleProduct], page: 1, pageSize: 1, totalCount: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", data: [{ ...sampleProduct, id: "me1-s2" }], page: 2, pageSize: 1, totalCount: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAllSealedProducts();
    expect(result.products).toHaveLength(2);
    expect(result.requests).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("test-api-key");
    expect(headers["X-Team-ID"]).toBe("test-team");
  });
});

