import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch } from "wouter";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PokéCard, { PokéCardSkeleton } from "@/components/PokeCard";
import { cn } from "@/lib/utils";

const TYPES = ["Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Dragon", "Colorless", "Fairy"];
const RARITIES = [
  "Common", "Uncommon", "Rare", "Rare Holo", "Rare Holo EX", "Rare Holo GX",
  "Rare Holo V", "Rare Holo VMAX", "Rare Holo VSTAR", "Double Rare",
  "Illustration Rare", "Special Illustration Rare", "Hyper Rare",
  "Ultra Rare", "Secret Rare", "Rainbow Rare", "Gold Rare",
];
const SUPERTYPES = ["Pokémon", "Trainer", "Energy"];
const PAGE_SIZE = 24;

const SPECIAL_RARITIES = new Set([
  "Special Illustration Rare", "Hyper Rare", "Secret Rare", "Rainbow Rare",
  "Gold Rare", "Illustration Rare", "Double Rare", "Ultra Rare",
]);

export default function Cards() {
  usePageMeta("Cards", "Search every Pokémon TCG card ever printed with live prices from TCGPlayer and CardMarket.");
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [inputQ, setInputQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState(params.get("type") ?? "");
  const [rarity, setRarity] = useState(params.get("rarity") ?? "");
  const [supertype, setSupertype] = useState("");
  const [set, setSet] = useState(params.get("set") ?? "");

  // Keep filters in sync when the URL query changes (e.g. Home → set card)
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setInputQ(params.get("q") ?? "");
    setType(params.get("type") ?? "");
    setRarity(params.get("rarity") ?? "");
    setSet(params.get("set") ?? "");
    setPage(1);
  }, [params]);
  const [showFilters, setShowFilters] = useState(false);

  // Infinite scroll state
  const [page, setPage] = useState(1);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: setsData } = trpc.sets.list.useQuery();
  const { data, isLoading, isFetching } = trpc.cards.search.useQuery({
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
    type: type || undefined,
    rarity: rarity || undefined,
    supertype: supertype || undefined,
    set: set || undefined,
  });

  // Accumulate cards across pages
  useEffect(() => {
    if (!data) return;
    if (page === 1) {
      setAllCards(data.data);
    } else {
      setAllCards((prev) => {
        const existingIds = new Set(prev.map((c: any) => c.id));
        const newCards = data.data.filter((c: any) => !existingIds.has(c.id));
        return [...prev, ...newCards];
      });
    }
    setTotalCount(data.totalCount);
  }, [data, page]);

  const hasMore = allCards.length < totalCount;

  const loadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage((p) => p + 1);
    }
  }, [isFetching, hasMore]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          loadMore();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetching, loadMore]);

  // Reset when filters change
  const resetFilters = useCallback(() => {
    setPage(1);
    setAllCards([]);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(inputQ);
    resetFilters();
  };

  const clearFilters = () => {
    setQ(""); setInputQ(""); setType(""); setRarity(""); setSupertype(""); setSet("");
    resetFilters();
  };

  const hasFilters = q || type || rarity || supertype || set;

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2">Card Database</h1>
        <p className="text-muted-foreground">
          {totalCount > 0 ? (
            <span><span className="text-foreground font-semibold">{totalCount.toLocaleString()}</span> cards found</span>
          ) : "Browse 15,000+ Pokémon TCG cards with live prices"}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              placeholder="Search by name or code (e.g. PAL 123, 25/102)…"
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
            />
          </div>
          <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("gap-1.5", showFilters && "bg-accent")}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </form>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select value={type} onValueChange={(v) => { setType(v === "_all" ? "" : v); resetFilters(); }}>
              <SelectTrigger className="bg-background border-border text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Types</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={rarity} onValueChange={(v) => { setRarity(v === "_all" ? "" : v); resetFilters(); }}>
              <SelectTrigger className="bg-background border-border text-sm">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Rarities</SelectItem>
                {RARITIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={supertype} onValueChange={(v) => { setSupertype(v === "_all" ? "" : v); resetFilters(); }}>
              <SelectTrigger className="bg-background border-border text-sm">
                <SelectValue placeholder="Supertype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Supertypes</SelectItem>
                {SUPERTYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={set} onValueChange={(v) => { setSet(v === "_all" ? "" : v); resetFilters(); }}>
              <SelectTrigger className="bg-background border-border text-sm">
                <SelectValue placeholder="Set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Sets</SelectItem>
                {setsData?.sets.slice(0, 50).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Active filters */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Active:</span>
            {q && <Badge variant="secondary" className="gap-1 text-xs">{q} <button onClick={() => { setQ(""); setInputQ(""); resetFilters(); }}><X className="w-3 h-3" /></button></Badge>}
            {type && <Badge variant="secondary" className="gap-1 text-xs">{type} <button onClick={() => { setType(""); resetFilters(); }}><X className="w-3 h-3" /></button></Badge>}
            {rarity && <Badge variant="secondary" className="gap-1 text-xs">{rarity} <button onClick={() => { setRarity(""); resetFilters(); }}><X className="w-3 h-3" /></button></Badge>}
            {supertype && <Badge variant="secondary" className="gap-1 text-xs">{supertype} <button onClick={() => { setSupertype(""); resetFilters(); }}><X className="w-3 h-3" /></button></Badge>}
            {set && <Badge variant="secondary" className="gap-1 text-xs">{set} <button onClick={() => { setSet(""); resetFilters(); }}><X className="w-3 h-3" /></button></Badge>}
            <button onClick={clearFilters} className="text-xs text-destructive hover:underline">Clear all</button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {/* Existing cards */}
        {allCards.map((card: any) => {
          const prices = card.tcgplayer?.prices;
          const price = prices?.holofoil?.market ?? prices?.normal?.market ?? prices?.reverseHolofoil?.market ?? null;
          return (
            <PokéCard
              key={card.id}
              id={card.id}
              name={card.name}
              imageUrl={card.images.small}
              setName={card.set.name}
              rarity={card.rarity}
              types={card.types}
              price={price}
              isSpecialRare={SPECIAL_RARITIES.has(card.rarity ?? "")}
            />
          );
        })}

        {/* Loading skeletons for first load */}
        {isLoading && page === 1 && Array.from({ length: PAGE_SIZE }).map((_, i) => <PokéCardSkeleton key={i} />)}
      </div>

      {/* Empty state */}
      {!isLoading && allCards.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-lg font-semibold text-foreground mb-2">No cards found</p>
          <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
          <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading indicator for subsequent pages */}
      {isFetching && page > 1 && (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading more cards…</span>
        </div>
      )}

      {/* End of results */}
      {!hasMore && allCards.length > 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          All {totalCount.toLocaleString()} cards loaded
        </div>
      )}
    </div>
  );
}
