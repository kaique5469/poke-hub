import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { externalApiCacheKey } from "./externalApiCacheDb";
import {
  pokemonRetryDelayMs,
  resetPokemonTcgResilienceForTests,
  searchCards,
  shouldRetryPokemonStatus,
} from "./lib/pokemontcg";

describe("Pokémon TCG catalog resilience", () => {
  beforeEach(() => {
    resetPokemonTcgResilienceForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetPokemonTcgResilienceForTests();
  });

  it("retries transient failures with progressively longer delays", () => {
    expect(shouldRetryPokemonStatus(429)).toBe(true);
    expect(shouldRetryPokemonStatus(500)).toBe(true);
    expect(shouldRetryPokemonStatus(503)).toBe(true);
    expect(shouldRetryPokemonStatus(404)).toBe(false);
    expect(pokemonRetryDelayMs(1, 0)).toBeGreaterThan(
      pokemonRetryDelayMs(0, 0)
    );
  });

  it("recovers when a later upstream attempt succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 500 }))
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            page: 1,
            pageSize: 24,
            count: 0,
            totalCount: 0,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const request = searchCards({ q: "resilience-test", pageSize: 24 });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(request).resolves.toMatchObject({ totalCount: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not expose the upstream request path after all retries fail", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("temporary", { status: 500 }))
    );

    const request = searchCards({ q: "private-search-value", pageSize: 24 });
    const settled = request.then(
      () => null,
      error => error as Error
    );
    await vi.advanceTimersByTimeAsync(5_000);
    const error = await settled;
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      "Card catalog is temporarily unavailable. Please try again shortly."
    );
    expect(error?.message).not.toContain("private-search-value");
  });

  it("hashes persistent keys without retaining the raw visitor query", () => {
    const first = externalApiCacheKey("pokemontcg", "search:name:pikachu");
    const again = externalApiCacheKey("pokemontcg", "search:name:pikachu");
    const different = externalApiCacheKey("pokemontcg", "search:name:eevee");
    expect(first).toBe(again);
    expect(first).not.toBe(different);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("pikachu");
  });
});
