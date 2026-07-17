/**
 * Guess the Pokémon — server-side evaluation logic.
 * The target is never sent to the client; every guess is graded here using
 * the existing Pokédex index plus PokeAPI evolution chains (cached 24h).
 */
import { cached, TTL } from "./cache";
import { getFullPokedex, type PokedexEntry } from "./pokedex";

export type GameDifficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  label: string;
  maxAttempts: number;
  pointsPerAttempt: number;
  maxScore: number;
}

export const DEFAULT_DIFFICULTY: GameDifficulty = "medium";

/**
 * Difficulty is authoritative on the server. Hard mode is intentionally worth
 * more because it uses the complete National Dex and gives fewer attempts.
 */
export const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    maxAttempts: 15,
    pointsPerAttempt: 8,
    maxScore: 120,
  },
  medium: {
    label: "Medium",
    maxAttempts: 12,
    pointsPerAttempt: 15,
    maxScore: 180,
  },
  hard: {
    label: "Hard",
    maxAttempts: 9,
    pointsPerAttempt: 30,
    maxScore: 270,
  },
};

export function isGameDifficulty(value: unknown): value is GameDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export function getDifficultyConfig(
  difficulty: GameDifficulty
): DifficultyConfig {
  return DIFFICULTY_CONFIG[difficulty];
}

export function calculateRoundScore(
  difficulty: GameDifficulty,
  winningAttempt: number
): number {
  const config = getDifficultyConfig(difficulty);
  if (winningAttempt < 1 || winningAttempt > config.maxAttempts) return 0;
  return (config.maxAttempts - winningAttempt + 1) * config.pointsPerAttempt;
}

/**
 * Recognisable mascots, starters, evolutions, legendaries and fan favourites.
 * Easy mode always picks from this hand-curated pool when those entries exist.
 */
const EASY_TARGET_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 25, 26, 35, 36, 39, 40, 52, 53, 54, 55, 58, 59,
  63, 65, 66, 68, 74, 76, 77, 78, 92, 93, 94, 95, 104, 105, 113, 123, 124, 125,
  126, 127, 129, 130, 131, 132, 133, 134, 135, 136, 143, 144, 145, 146, 147,
  149, 150, 151, 152, 155, 158, 172, 175, 176, 179, 181, 185, 196, 197, 208,
  212, 214, 228, 229, 243, 244, 245, 246, 248, 249, 250, 251, 252, 255, 258,
  280, 282, 287, 289, 302, 303, 304, 306, 328, 330, 333, 334, 349, 350, 359,
  371, 373, 374, 376, 380, 381, 384, 385, 386, 387, 390, 393, 403, 405, 443,
  445, 447, 448, 470, 471, 479, 483, 484, 487, 491, 492, 493, 494, 495, 498,
  501, 570, 571, 607, 609, 610, 612, 633, 635, 638, 639, 640, 643, 644, 646,
  650, 653, 656, 658, 661, 663, 700, 701, 704, 706, 716, 717, 718, 722, 725,
  728, 744, 745, 778, 791, 792, 802, 810, 813, 816, 821, 823, 831, 849, 872,
  873, 885, 887, 888, 889, 892, 906, 909, 912, 915, 921, 923, 936, 959, 963,
  964, 999, 1000, 1007, 1008,
]);

/** Later-generation favourites added to the broad Gen 1–5 medium pool. */
const MEDIUM_LATER_IDS = new Set([...EASY_TARGET_IDS].filter(id => id >= 650));

export const REGION_BY_GEN: Record<number, string> = {
  1: "Kanto",
  2: "Johto",
  3: "Hoenn",
  4: "Sinnoh",
  5: "Unova",
  6: "Kalos",
  7: "Alola",
  8: "Galar",
  9: "Paldea",
};

export type WarmthTier = "green" | "yellow" | "blue" | "red" | "win";

export interface GuessFeedback {
  tier: WarmthTier;
  /** Which yellow sub-signal matched (type or generation) */
  match: "exact" | "family" | "type" | "generation" | "region" | "none";
  message: string;
  detail: string;
  guess: {
    id: number;
    name: string;
    sprite: string;
    types: string[];
    generation: number;
    region: string;
  };
  attempt: number;
  /** Per-dimension comparison for the hint chips shown under each card */
  comparisons: {
    family: boolean;
    sharedType: string | null;
    generation: boolean;
    region: boolean;
  };
}

interface EvoFamily {
  /** Base species name of the chain, e.g. "bulbasaur" */
  familyName: string;
  /** All national-dex ids in the chain */
  ids: number[];
}

interface SpeciesRef {
  url: string;
}

/** species id -> evolution family (chain ids + family name), cached 24h per species. */
export async function getEvolutionFamily(id: number): Promise<EvoFamily> {
  return cached(`game:family:${id}`, TTL.ONE_DAY, async () => {
    const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!sRes.ok) throw new Error(`species ${id} failed: ${sRes.status}`);
    const species = (await sRes.json()) as {
      evolution_chain: SpeciesRef | null;
      name: string;
    };
    if (!species.evolution_chain?.url)
      return { familyName: species.name, ids: [id] };

    const cRes = await fetch(species.evolution_chain.url);
    if (!cRes.ok) return { familyName: species.name, ids: [id] };
    interface ChainNode {
      species: { name: string; url: string };
      evolves_to: ChainNode[];
    }
    const chain = (await cRes.json()) as { chain: ChainNode };

    const ids: number[] = [];
    let familyName = "";
    (function walk(node: ChainNode) {
      const nId = parseInt(
        node.species.url.split("/").filter(Boolean).pop() ?? "0"
      );
      if (!familyName) familyName = node.species.name;
      if (nId > 0) ids.push(nId);
      node.evolves_to.forEach(walk);
    })(chain.chain);

    return {
      familyName: familyName || species.name,
      ids: ids.length ? ids : [id],
    };
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getDexEntry(id: number): Promise<PokedexEntry | null> {
  const dex = await getFullPokedex();
  return dex.find(p => p.id === id) ?? null;
}

export function selectTargetFromDex(
  dex: PokedexEntry[],
  difficulty: GameDifficulty,
  random: () => number = Math.random
): number {
  if (dex.length === 0) throw new Error("Pokédex is empty");

  let pool: PokedexEntry[];
  if (difficulty === "easy") {
    pool = dex.filter(p => EASY_TARGET_IDS.has(p.id));
  } else if (difficulty === "medium") {
    pool = dex.filter(p => p.id <= 649 || MEDIUM_LATER_IDS.has(p.id));
  } else {
    // Hard is deliberately unweighted: every National Dex entry is possible.
    pool = dex;
  }

  const candidates = pool.length > 0 ? pool : dex;
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length))
  );
  return candidates[index].id;
}

export async function pickRandomTarget(
  difficulty: GameDifficulty
): Promise<number> {
  const dex = await getFullPokedex();
  return selectTargetFromDex(dex, difficulty);
}

/**
 * Priority ladder (spec §2):
 * exact -> WIN; same evo family -> GREEN; same type -> YELLOW(type);
 * same generation -> YELLOW(gen); same region -> BLUE; else RED.
 * (Region == generation region here, so BLUE covers near-region overlaps.)
 */
export async function evaluateGuess(
  guessId: number,
  targetId: number,
  attempt: number
): Promise<GuessFeedback> {
  const [guess, target] = await Promise.all([
    getDexEntry(guessId),
    getDexEntry(targetId),
  ]);
  if (!guess || !target) throw new Error("Pokémon not found");

  const [gFam, tFam] = await Promise.all([
    getEvolutionFamily(guess.id).catch(() => null),
    getEvolutionFamily(target.id).catch(() => null),
  ]);

  const exact = guess.id === target.id;
  const sameFamily = exact || !!(gFam && tFam && tFam.ids.includes(guess.id));
  const sharedType = guess.types.find(t => target.types.includes(t)) ?? null;
  const sameGen = guess.generation === target.generation;
  const sameRegion = sameGen; // regions map 1:1 to generations

  const base = {
    guess: {
      id: guess.id,
      name: cap(guess.name),
      sprite: guess.sprite,
      types: guess.types,
      generation: guess.generation,
      region: REGION_BY_GEN[guess.generation] ?? "Unknown",
    },
    attempt,
    comparisons: {
      family: sameFamily,
      sharedType,
      generation: sameGen,
      region: sameRegion,
    },
  };

  if (exact) {
    return {
      ...base,
      tier: "win",
      match: "exact",
      message: `Exact match! It's ${cap(target.name)}!`,
      detail: "You found the target Pokémon.",
    };
  }

  if (sameFamily) {
    return {
      ...base,
      tier: "green",
      match: "family",
      message: "Same evolutionary line!",
      detail: `The target is in the ${cap(tFam?.familyName ?? guess.name)} family.`,
    };
  }

  if (sharedType) {
    return {
      ...base,
      tier: "yellow",
      match: "type",
      message: "Same energy type!",
      detail: `Target uses ${cap(sharedType)} energy.`,
    };
  }

  if (sameGen) {
    return {
      ...base,
      tier: "yellow",
      match: "generation",
      message: "Same generation!",
      detail: `Target is from Generation ${guess.generation} (${REGION_BY_GEN[guess.generation] ?? ""}).`,
    };
  }

  if (Math.abs(guess.generation - target.generation) === 1) {
    return {
      ...base,
      tier: "blue",
      match: "region",
      message: "Different type and evolution, but you're close.",
      detail: "The target is from a neighboring generation.",
    };
  }

  return {
    ...base,
    tier: "red",
    match: "none",
    message: "Completely different. Keep trying!",
    detail: "No match on type, evolution line, generation or region.",
  };
}
