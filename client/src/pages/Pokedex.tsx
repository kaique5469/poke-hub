import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { Search, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const TYPES: Array<{ id: string; label: string; color: string; icon: string }> = [
  { id: "normal", label: "Normal", color: "#A8A878", icon: "⚪" },
  { id: "fire", label: "Fire", color: "#F08030", icon: "🔥" },
  { id: "water", label: "Water", color: "#6890F0", icon: "💧" },
  { id: "electric", label: "Electric", color: "#F8D030", icon: "⚡" },
  { id: "grass", label: "Grass", color: "#78C850", icon: "🌿" },
  { id: "ice", label: "Ice", color: "#98D8D8", icon: "❄️" },
  { id: "fighting", label: "Fighting", color: "#C03028", icon: "🥊" },
  { id: "poison", label: "Poison", color: "#A040A0", icon: "☠️" },
  { id: "ground", label: "Ground", color: "#E0C068", icon: "🌍" },
  { id: "flying", label: "Flying", color: "#A890F0", icon: "🦅" },
  { id: "psychic", label: "Psychic", color: "#F85888", icon: "🔮" },
  { id: "bug", label: "Bug", color: "#A8B820", icon: "🐛" },
  { id: "rock", label: "Rock", color: "#B8A038", icon: "🪨" },
  { id: "ghost", label: "Ghost", color: "#705898", icon: "👻" },
  { id: "dragon", label: "Dragon", color: "#7038F8", icon: "🐉" },
  { id: "dark", label: "Dark", color: "#705848", icon: "🌑" },
  { id: "steel", label: "Steel", color: "#B8B8D0", icon: "⚙️" },
  { id: "fairy", label: "Fairy", color: "#EE99AC", icon: "🧚" },
];

const GENERATIONS = [
  { value: 1, label: "Gen I — Kanto", count: 151 },
  { value: 2, label: "Gen II — Johto", count: 100 },
  { value: 3, label: "Gen III — Hoenn", count: 135 },
  { value: 4, label: "Gen IV — Sinnoh", count: 107 },
  { value: 5, label: "Gen V — Unova", count: 156 },
  { value: 6, label: "Gen VI — Kalos", count: 72 },
  { value: 7, label: "Gen VII — Alola", count: 88 },
  { value: 8, label: "Gen VIII — Galar", count: 96 },
  { value: 9, label: "Gen IX — Paldea", count: 120 },
];

interface DexEntry {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  generation: number;
}

const PAGE_SIZE = 48;
const displayName = (n: string) =>
  n.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

function TypeBadge({ type }: { type: string }) {
  const t = TYPES.find(t => t.id === type);
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
      style={{ background: t?.color ?? "#9CA3AF" }} title={t?.label ?? type}>
      {t?.icon ?? "?"}
    </span>
  );
}

function PokemonCard({ p }: { p: DexEntry }) {
  const [imgError, setImgError] = useState(false);
  const mainType = TYPES.find(t => t.id === p.types[0]);
  return (
    <Link href={`/pokedex/${p.id}`}
      className="bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col items-center">
      <div className="w-full aspect-square rounded-xl flex items-center justify-center"
        style={{ background: `${mainType?.color ?? "#9CA3AF"}14` }}>
        {!imgError ? (
          <img src={p.sprite} alt={p.name} loading="lazy"
            className="w-[85%] h-[85%] object-contain group-hover:scale-110 transition-transform duration-200"
            onError={() => setImgError(true)} />
        ) : <span className="text-3xl">❓</span>}
      </div>
      <p className="text-[11px] font-bold mt-2" style={{ color: "oklch(0.52 0.015 240)" }}>
        #{String(p.id).padStart(4, "0")}
      </p>
      <p className="font-black text-sm text-center line-clamp-1" style={{ color: "oklch(0.18 0.02 240)" }}>
        {displayName(p.name)}
      </p>
      <div className="flex gap-1 mt-1.5">
        {p.types.map(t => <TypeBadge key={t} type={t} />)}
      </div>
    </Link>
  );
}

export default function Pokedex() {
  usePageMeta("Pokédex", "Complete National Pokédex — all 1,025 Pokémon from every generation with types and stats.");
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [type, setType] = useState<string | null>(params.get("type"));
  const [generation, setGeneration] = useState<number | null>(
    params.get("gen") ? Number(params.get("gen")) : null,
  );
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<DexEntry[]>([]);

  const { data, isLoading, isFetching } = trpc.pokemon.list.useQuery({
    q: search.trim() || undefined,
    type: type ?? undefined,
    generation: generation ?? undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: typeCounts } = trpc.pokemon.typeCounts.useQuery();

  // Accumulate pages for infinite scroll; reset on filter change
  useEffect(() => {
    if (!data) return;
    setEntries(prev => (data.page === 1 ? data.items : [...prev, ...data.items]));
  }, [data]);

  const resetAnd = (fn: () => void) => { fn(); setPage(1); setEntries([]); };

  const hasMore = !!data && data.page < data.totalPages;
  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading: isFetching,
    onLoadMore: () => setPage(p => p + 1),
  });

  const total = data?.total ?? 0;
  const activeFilters = useMemo(
    () => [
      search.trim() && `"${search.trim()}"`,
      type && TYPES.find(t => t.id === type)?.label,
      generation && GENERATIONS.find(g => g.value === generation)?.label,
    ].filter(Boolean),
    [search, type, generation],
  );

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="page-header">
        <div className="container">
          <h1 className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>Pokédex</h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>
            Complete National Pokédex — all 1,025 Pokémon across 9 generations
          </p>
        </div>
      </div>

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-60 shrink-0 space-y-4 hidden lg:block">
            <div className="filter-sidebar">
              <div className="filter-section-title"><Search className="w-4 h-4" style={{ color: "oklch(0.54 0.25 293)" }} />Search</div>
              <div className="search-bar">
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.62 0.01 240)" }} />
                <input value={search} onChange={e => resetAnd(() => setSearch(e.target.value))}
                  placeholder="Name or number..." className="flex-1 text-sm" />
                {search && <button onClick={() => resetAnd(() => setSearch(""))}><X className="w-3.5 h-3.5" style={{ color: "oklch(0.62 0.01 240)" }} /></button>}
              </div>
            </div>

            <div className="filter-sidebar">
              <div className="filter-section-title">Type<div className="h-px flex-1" style={{ background: "oklch(0.88 0.01 240)" }} /></div>
              <div className="space-y-0.5 max-h-80 overflow-y-auto">
                <button onClick={() => resetAnd(() => setType(null))}
                  className={cn("filter-option w-full", type === null && "active")}>All Types</button>
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => resetAnd(() => setType(type === t.id ? null : t.id))}
                    className={cn("filter-option w-full justify-between", type === t.id && "active")}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </span>
                    {typeCounts && (
                      <span className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.01 240)" }}>
                        {typeCounts[t.id] ?? 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-sidebar">
              <div className="filter-section-title">Generation<div className="h-px flex-1" style={{ background: "oklch(0.88 0.01 240)" }} /></div>
              <div className="space-y-0.5">
                <button onClick={() => resetAnd(() => setGeneration(null))}
                  className={cn("filter-option w-full", generation === null && "active")}>All Generations</button>
                {GENERATIONS.map(g => (
                  <button key={g.value}
                    onClick={() => resetAnd(() => setGeneration(generation === g.value ? null : g.value))}
                    className={cn("filter-option w-full justify-between", generation === g.value && "active")}>
                    <span>{g.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: "oklch(0.62 0.01 240)" }}>{g.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="lg:hidden mb-4 space-y-2">
              <div className="search-bar">
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.62 0.01 240)" }} />
                <input value={search} onChange={e => resetAnd(() => setSearch(e.target.value))}
                  placeholder="Name or number..." className="flex-1 text-sm" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => resetAnd(() => setType(type === t.id ? null : t.id))}
                    className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border transition-all",
                      type === t.id ? "text-white border-transparent" : "bg-white border-gray-200")}
                    style={type === t.id ? { background: t.color } : { color: t.color }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <p className="text-sm font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>
                {isLoading && entries.length === 0 ? "Loading…" : `${total.toLocaleString()} Pokémon`}
                {activeFilters.length > 0 && <span className="font-normal"> · {activeFilters.join(" · ")}</span>}
              </p>
              {activeFilters.length > 0 && (
                <button onClick={() => resetAnd(() => { setSearch(""); setType(null); setGeneration(null); })}
                  className="text-xs font-bold" style={{ color: "oklch(0.54 0.25 293)" }}>Clear filters</button>
              )}
            </div>

            {isLoading && entries.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20">
                <span className="text-6xl">🔍</span>
                <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>No Pokémon found</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                  {entries.map(p => <PokemonCard key={p.id} p={p} />)}
                </div>
                <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
                  {isFetching && hasMore && <Loader2 className="w-5 h-5 animate-spin" style={{ color: "oklch(0.54 0.25 293)" }} />}
                  {!hasMore && entries.length > 0 && (
                    <p className="text-xs font-bold" style={{ color: "oklch(0.62 0.01 240)" }}>
                      All {total.toLocaleString()} Pokémon loaded ✓
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
