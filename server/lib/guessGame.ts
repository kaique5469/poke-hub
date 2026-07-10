/**
 * Guess the Pokémon — server-side evaluation logic.
 * The target is never sent to the client; every guess is graded here using
 * the existing Pokédex index plus PokeAPI evolution chains (cached 24h).
 */
import { cached, TTL } from "./cache";
import { getFullPokedex, type PokedexEntry } from "./pokedex";

export const MAX_ATTEMPTS = 15;
export const POINTS_PER_ATTEMPT = 10;

export const REGION_BY_GEN: Record<number, string> = {
  1: "Kanto", 2: "Johto", 3: "Hoenn", 4: "Sinnoh", 5: "Unova",
  6: "Kalos", 7: "Alola", 8: "Galar", 9: "Paldea",
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
}

interface EvoFamily {
  /** Base species name of the chain, e.g. "bulbasaur" */
  familyName: string;
  /** All national-dex ids in the chain */
  ids: number[];
}

interface SpeciesRef { url: string }

/** species id -> evolution family (chain ids + family name), cached 24h per species. */
export async function getEvolutionFamily(id: number): Promise<EvoFamily> {
  return cached(`game:family:${id}`, TTL.ONE_DAY, async () => {
    const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
    if (!sRes.ok) throw new Error(`species ${id} failed: ${sRes.status}`);
    const species = (await sRes.json()) as { evolution_chain: SpeciesRef | null; name: string };
    if (!species.evolution_chain?.url) return { familyName: species.name, ids: [id] };

    const cRes = await fetch(species.evolution_chain.url);
    if (!cRes.ok) return { familyName: species.name, ids: [id] };
    interface ChainNode { species: { name: string; url: string }; evolves_to: ChainNode[] }
    const chain = (await cRes.json()) as { chain: ChainNode };

    const ids: number[] = [];
    let familyName = "";
    (function walk(node: ChainNode) {
      const nId = parseInt(node.species.url.split("/").filter(Boolean).pop() ?? "0");
      if (!familyName) familyName = node.species.name;
      if (nId > 0) ids.push(nId);
      node.evolves_to.forEach(walk);
    })(chain.chain);

    return { familyName: familyName || species.name, ids: ids.length ? ids : [id] };
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getDexEntry(id: number): Promise<PokedexEntry | null> {
  const dex = await getFullPokedex();
  return dex.find((p) => p.id === id) ?? null;
}

export async function pickRandomTarget(): Promise<number> {
  const dex = await getFullPokedex();
  return dex[Math.floor(Math.random() * dex.length)].id;
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
  attempt: number,
): Promise<GuessFeedback> {
  const [guess, target] = await Promise.all([getDexEntry(guessId), getDexEntry(targetId)]);
  if (!guess || !target) throw new Error("Pokémon not found");

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
  };

  if (guess.id === target.id) {
    return {
      ...base,
      tier: "win",
      match: "exact",
      message: `Exact match! It's ${cap(target.name)}!`,
      detail: "You found the target Pokémon.",
    };
  }

  // Same evolutionary family (strongest hint)
  const [gFam, tFam] = await Promise.all([
    getEvolutionFamily(guess.id).catch(() => null),
    getEvolutionFamily(target.id).catch(() => null),
  ]);
  if (gFam && tFam && tFam.ids.includes(guess.id)) {
    return {
      ...base,
      tier: "green",
      match: "family",
      message: "Same evolutionary line!",
      detail: `The target is in the ${cap(tFam.familyName)} family.`,
    };
  }

  const sharedType = guess.types.find((t) => target.types.includes(t));
  if (sharedType) {
    return {
      ...base,
      tier: "yellow",
      match: "type",
      message: "Same energy type!",
      detail: `Target uses ${cap(sharedType)} energy.`,
    };
  }

  if (guess.generation === target.generation) {
    return {
      ...base,
      tier: "yellow",
      match: "generation",
      message: "Same generation!",
      detail: `Target is from Generation ${guess.generation} (${REGION_BY_GEN[guess.generation] ?? ""}).`,
    };
  }

  // Adjacent-region partial hint: same region grouping (gen ±1 shares no region
  // in the main series, so treat "close generation" as the cool BLUE hint)
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
