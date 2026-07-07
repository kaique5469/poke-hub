/**
 * Full National Pokédex index built from PokeAPI, cached server-side for 24h.
 * Supports text search, type filter and generation filter — all resolved in
 * memory after the first (cached) fetch, so pagination is instant.
 */
import { cached, TTL } from "./cache";

export interface PokedexEntry {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  generation: number;
}

export const GENERATION_RANGES: Record<number, [number, number]> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
};

export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
  "steel", "fairy",
] as const;

const MAX_DEX_ID = 1025;

const artwork = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

function generationOf(id: number): number {
  for (const [gen, [lo, hi]] of Object.entries(GENERATION_RANGES)) {
    if (id >= lo && id <= hi) return Number(gen);
  }
  return 0;
}

interface SpeciesListResponse {
  results: { name: string; url: string }[];
}
interface TypeResponse {
  pokemon: { pokemon: { name: string; url: string } }[];
}

/** id -> species name for the whole National Dex (1 request, cached 24h). */
async function getNameIndex(): Promise<Map<number, string>> {
  return cached("pokedex:names", TTL.ONE_DAY, async () => {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species?limit=${MAX_DEX_ID}`);
    if (!res.ok) throw new Error(`PokeAPI species list failed: ${res.status}`);
    const data = (await res.json()) as SpeciesListResponse;
    const map = new Map<number, string>();
    for (const s of data.results) {
      const id = parseInt(s.url.split("/").filter(Boolean).pop() ?? "0");
      if (id >= 1 && id <= MAX_DEX_ID) map.set(id, s.name);
    }
    return map;
  });
}

/** id -> types[] built from the 18 type endpoints (18 requests, cached 24h). */
async function getTypeIndex(): Promise<Map<number, string[]>> {
  return cached("pokedex:types", TTL.ONE_DAY, async () => {
    const map = new Map<number, string[]>();
    const responses = await Promise.all(
      POKEMON_TYPES.map(async (type) => {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
        if (!res.ok) return { type, entries: [] as TypeResponse["pokemon"] };
        const data = (await res.json()) as TypeResponse;
        return { type, entries: data.pokemon };
      }),
    );
    for (const { type, entries } of responses) {
      for (const e of entries) {
        const id = parseInt(e.pokemon.url.split("/").filter(Boolean).pop() ?? "0");
        // Only default forms (id within National Dex range)
        if (id >= 1 && id <= MAX_DEX_ID) {
          const list = map.get(id) ?? [];
          list.push(type);
          map.set(id, list);
        }
      }
    }
    return map;
  });
}

/** Complete, sorted National Dex (cached composition of the two indexes). */
export async function getFullPokedex(): Promise<PokedexEntry[]> {
  return cached("pokedex:full", TTL.ONE_DAY, async () => {
    const [names, types] = await Promise.all([getNameIndex(), getTypeIndex()]);
    const entries: PokedexEntry[] = [];
    for (let id = 1; id <= MAX_DEX_ID; id++) {
      const name = names.get(id);
      if (!name) continue;
      entries.push({
        id,
        name,
        sprite: artwork(id),
        types: types.get(id) ?? [],
        generation: generationOf(id),
      });
    }
    return entries;
  });
}

export interface PokedexQuery {
  q?: string;
  type?: string;
  generation?: number;
  page?: number;
  pageSize?: number;
}

export async function queryPokedex(input: PokedexQuery) {
  const all = await getFullPokedex();
  const q = input.q?.trim().toLowerCase();

  let filtered = all;
  if (q) {
    filtered = filtered.filter(p =>
      p.name.includes(q) || String(p.id) === q.replace(/^#/, ""));
  }
  if (input.type) {
    filtered = filtered.filter(p => p.types.includes(input.type as string));
  }
  if (input.generation) {
    filtered = filtered.filter(p => p.generation === input.generation);
  }

  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 48, 120);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.ceil(filtered.length / pageSize),
  };
}

/** Type counts for the sidebar filter (like Liga Pokémon shows). */
export async function getPokedexTypeCounts(): Promise<Record<string, number>> {
  const all = await getFullPokedex();
  const counts: Record<string, number> = {};
  for (const t of POKEMON_TYPES) counts[t] = 0;
  for (const p of all) for (const t of p.types) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}
