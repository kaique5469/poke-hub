import { describe, expect, it } from "vitest";
import { decodeRoundState } from "./gameDb";
import {
  calculateRoundScore,
  DIFFICULTY_CONFIG,
  getDifficultyConfig,
  selectTargetFromDex,
  type GuessFeedback,
} from "./lib/guessGame";
import type { PokedexEntry } from "./lib/pokedex";

const entry = (id: number): PokedexEntry => ({
  id,
  name: `pokemon-${id}`,
  sprite: `https://example.com/${id}.png`,
  types: ["normal"],
  generation: id <= 151 ? 1 : id <= 649 ? 5 : 9,
});

describe("Guess the Pokémon difficulty", () => {
  it("awards progressively higher maximum scores", () => {
    expect(DIFFICULTY_CONFIG.easy.maxScore).toBe(120);
    expect(DIFFICULTY_CONFIG.medium.maxScore).toBe(180);
    expect(DIFFICULTY_CONFIG.hard.maxScore).toBe(270);
    expect(DIFFICULTY_CONFIG.hard.pointsPerAttempt).toBeGreaterThan(
      DIFFICULTY_CONFIG.medium.pointsPerAttempt
    );
  });

  it("keeps config maximums equal to attempts times points", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const config = getDifficultyConfig(difficulty);
      expect(config.maxScore).toBe(
        config.maxAttempts * config.pointsPerAttempt
      );
    }
  });

  it("calculates first-try and last-try rewards on the server", () => {
    expect(calculateRoundScore("easy", 1)).toBe(120);
    expect(calculateRoundScore("medium", 1)).toBe(180);
    expect(calculateRoundScore("hard", 1)).toBe(270);
    expect(calculateRoundScore("hard", 9)).toBe(30);
    expect(calculateRoundScore("hard", 10)).toBe(0);
  });

  it("limits easy targets to recognisable curated Pokémon", () => {
    const dex = [entry(25), entry(500), entry(1025)];
    expect(selectTargetFromDex(dex, "easy", () => 0.99)).toBe(25);
  });

  it("uses a broad pool for medium without obscure late entries", () => {
    const dex = [entry(25), entry(500), entry(1025)];
    expect(selectTargetFromDex(dex, "medium", () => 0.99)).toBe(500);
  });

  it("allows every National Dex entry in hard mode", () => {
    const dex = [entry(25), entry(500), entry(1025)];
    expect(selectTargetFromDex(dex, "hard", () => 0.99)).toBe(1025);
  });
});

describe("saved game compatibility", () => {
  const oldGuess = {
    tier: "red",
    match: "none",
    message: "Keep trying",
    detail: "No match",
    guess: {
      id: 25,
      name: "Pikachu",
      sprite: "https://example.com/25.png",
      types: ["electric"],
      generation: 1,
      region: "Kanto",
    },
    attempt: 1,
    comparisons: {
      family: false,
      sharedType: null,
      generation: false,
      region: false,
    },
  } satisfies GuessFeedback;

  it("resumes legacy 15-attempt rounds as easy", () => {
    expect(decodeRoundState([oldGuess])).toEqual({
      difficulty: "easy",
      guesses: [oldGuess],
    });
  });

  it("restores the selected difficulty from the new JSON state", () => {
    expect(
      decodeRoundState({
        version: 2,
        difficulty: "hard",
        guesses: [oldGuess],
      })
    ).toEqual({ difficulty: "hard", guesses: [oldGuess] });
  });
});
