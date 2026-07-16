import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { TypeIcon } from "@/components/TypeIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight,
  ExternalLink,
  Star,
  Zap,
  Shield,
  Heart,
  Swords,
  Wind,
  Eye,
  ArrowRight,
  ShoppingCart,
  BookOpen,
  TrendingUp,
  ChevronLeft,
  Flame,
  Loader2,
} from "lucide-react";

// ─── Type color map ───────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  fire:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200", icon: "🔥" },
  water:    { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",   icon: "💧" },
  grass:    { bg: "bg-green-50",    text: "text-green-700",   border: "border-green-200",  icon: "🌿" },
  electric: { bg: "bg-yellow-50",   text: "text-yellow-700",  border: "border-yellow-200", icon: "⚡" },
  psychic:  { bg: "bg-pink-50",     text: "text-pink-700",    border: "border-pink-200",   icon: "🔮" },
  ice:      { bg: "bg-cyan-50",     text: "text-cyan-700",    border: "border-cyan-200",   icon: "❄️" },
  dragon:   { bg: "bg-indigo-50",   text: "text-indigo-700",  border: "border-indigo-200", icon: "🐉" },
  dark:     { bg: "bg-gray-100",    text: "text-gray-800",    border: "border-gray-300",   icon: "🌑" },
  fairy:    { bg: "bg-rose-50",     text: "text-rose-700",    border: "border-rose-200",   icon: "✨" },
  fighting: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",    icon: "🥊" },
  poison:   { bg: "bg-purple-50",   text: "text-purple-700",  border: "border-purple-200", icon: "☠️" },
  ground:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",  icon: "🌍" },
  rock:     { bg: "bg-stone-50",    text: "text-stone-700",   border: "border-stone-200",  icon: "🪨" },
  bug:      { bg: "bg-lime-50",     text: "text-lime-700",    border: "border-lime-200",   icon: "🐛" },
  ghost:    { bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200", icon: "👻" },
  steel:    { bg: "bg-slate-50",    text: "text-slate-700",   border: "border-slate-200",  icon: "⚙️" },
  flying:   { bg: "bg-sky-50",      text: "text-sky-700",     border: "border-sky-200",    icon: "🦅" },
  normal:   { bg: "bg-neutral-50",  text: "text-neutral-700", border: "border-neutral-200",icon: "⭐" },
};

// ─── Stat config ──────────────────────────────────────────────────────────────
const STAT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "hp":              { label: "HP",       icon: <Heart className="w-3.5 h-3.5" />,   color: "bg-red-400" },
  "attack":          { label: "Attack",   icon: <Swords className="w-3.5 h-3.5" />,  color: "bg-orange-400" },
  "defense":         { label: "Defense",  icon: <Shield className="w-3.5 h-3.5" />,  color: "bg-yellow-400" },
  "special attack":  { label: "Sp. Atk", icon: <Zap className="w-3.5 h-3.5" />,    color: "bg-blue-400" },
  "special defense": { label: "Sp. Def", icon: <Eye className="w-3.5 h-3.5" />,    color: "bg-green-400" },
  "speed":           { label: "Speed",    icon: <Wind className="w-3.5 h-3.5" />,   color: "bg-purple-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatId(id: number) {
  return `#${String(id).padStart(4, "0")}`;
}

function formatHeight(h: number) {
  const meters = h / 10;
  const feet = Math.floor(meters * 3.28084);
  const inches = Math.round((meters * 3.28084 - feet) * 12);
  return `${meters.toFixed(1)} m (${feet}'${inches}")`;
}

function formatWeight(w: number) {
  const kg = w / 10;
  const lbs = (kg * 2.20462).toFixed(1);
  return `${kg.toFixed(1)} kg (${lbs} lbs)`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PokemonDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-8">
            <Skeleton className="w-64 h-64 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ─── TCG Card Item ─────────────────────────────────────────────────────────────
function TCGCardItem({ card }: { card: {
  id: string; name: string; image: string; set: string; rarity: string;
  number: string; isSpecialRare: boolean;
  price: { market?: number; low?: number } | null;
  links: { tcgplayer: string; ebay: string; cardmarket: string };
}}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden group">
      <div className="relative bg-gradient-to-b from-gray-50 to-gray-100 p-3 flex items-center justify-center h-48">
        {card.isSpecialRare && (
          <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">
            ✦ SR
          </span>
        )}
        <img
          src={card.image}
          alt={card.name}
          className="h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = "/card-placeholder.svg"; }}
        />
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm truncate">{card.name}</p>
        <p className="text-xs text-gray-500 truncate">{card.set} · #{card.number}</p>
        {card.rarity && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{card.rarity}</p>
        )}
        {card.price?.market && (
          <p className="text-sm font-bold text-blue-600 mt-1.5">${card.price.market.toFixed(2)}</p>
        )}
        <div className="flex gap-1.5 mt-2">
          <a
            href={card.links.tcgplayer}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="w-3 h-3" />
            TCGPlayer
          </a>
          <a
            href={card.links.ebay}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center text-[11px] font-medium border border-gray-200 text-gray-600 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Featured Cards Carousel ─────────────────────────────────────────────────
function FeaturedCardsCarousel({ cards, pokemonName, typeStyle }: {
  cards: Array<{
    id: string; name: string; image: string; set: string; rarity: string;
    number: string; isSpecialRare: boolean;
    price: { market?: number; low?: number } | null;
    links: { tcgplayer: string; ebay: string; cardmarket: string };
  }>;
  pokemonName: string;
  typeStyle: { bg: string; text: string; border: string; icon: string };
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Sort: special rares first, then by market price descending
  const featured = useMemo(() => {
    return [...cards]
      .sort((a, b) => {
        if (a.isSpecialRare && !b.isSpecialRare) return -1;
        if (!a.isSpecialRare && b.isSpecialRare) return 1;
        return (b.price?.market ?? 0) - (a.price?.market ?? 0);
      })
      .slice(0, 8);
  }, [cards]);

  if (featured.length === 0) return null;

  const prev = () => setActiveIdx((i) => (i - 1 + featured.length) % featured.length);
  const next = () => setActiveIdx((i) => (i + 1) % featured.length);
  const active = featured[activeIdx]!;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm ${typeStyle.border}`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${typeStyle.bg}`}>
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 ${typeStyle.text}`} />
          <span className={`text-sm font-bold ${typeStyle.text}`}>
            Featured Cards — {capitalize(pokemonName)}
          </span>
          <span className="text-xs text-gray-500 font-medium">Top {featured.length} by rarity &amp; price</span>
        </div>
        <Link href={`/cards?q=${encodeURIComponent(pokemonName)}`}>
          <span className={`text-xs font-semibold ${typeStyle.text} hover:underline flex items-center gap-1`}>
            View all <ExternalLink className="w-3 h-3" />
          </span>
        </Link>
      </div>

      <div className="bg-white p-4">
        <div className="flex gap-4 items-start">
          {/* Main featured card */}
          <div className="flex-shrink-0 relative group">
            <div className="w-40 sm:w-48 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl overflow-hidden border border-gray-100 shadow-md">
              <div className="relative p-3 flex items-center justify-center h-52">
                {active.isSpecialRare && (
                  <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">✦ SR</span>
                )}
                <img
                  src={active.image}
                  alt={active.name}
                  className="h-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/card-placeholder.svg"; }}
                />
              </div>
              <div className="px-3 pb-3">
                <p className="font-bold text-gray-900 text-sm truncate">{active.name}</p>
                <p className="text-xs text-gray-500 truncate">{active.set} · #{active.number}</p>
                {active.rarity && <p className="text-xs text-gray-400 mt-0.5 truncate">{active.rarity}</p>}
                {active.price?.market ? (
                  <p className="text-base font-extrabold text-blue-600 mt-1">${active.price.market.toFixed(2)}</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Price N/A</p>
                )}
                <div className="flex gap-1.5 mt-2">
                  <a href={active.links.tcgplayer} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 transition-colors">
                    <ShoppingCart className="w-3 h-3" /> Buy
                  </a>
                  <a href={active.links.ebay} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center text-[11px] border border-gray-200 text-gray-600 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
            {/* Prev/Next arrows */}
            <button onClick={prev}
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={next}
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Thumbnail strip */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Featured</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {featured.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                    idx === activeIdx
                      ? `${typeStyle.border} shadow-md scale-105`
                      : "border-gray-100 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-1 flex items-center justify-center h-20">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/card-placeholder.svg"; }}
                    />
                  </div>
                  {card.price?.market && (
                    <div className="bg-white px-1 py-0.5 text-center">
                      <p className="text-[10px] font-bold text-blue-600">${card.price.market.toFixed(0)}</p>
                    </div>
                  )}
                  {card.isSpecialRare && (
                    <span className="absolute top-0.5 right-0.5 text-[8px] bg-yellow-400 text-yellow-900 font-bold px-1 rounded-sm">SR</span>
                  )}
                </button>
              ))}
            </div>
            {/* Dot indicators */}
            <div className="flex gap-1.5 mt-3">
              {featured.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === activeIdx ? `${typeStyle.text.replace("text-", "bg-")} w-4` : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PokemonDetail() {
  const params = useParams<{ id: string }>();
  const pokemonId = params.id ?? "1";
  const [showShiny, setShowShiny] = useState(false);
  const [tcgPage, setTcgPage] = useState(1);
  const [allTcgCards, setAllTcgCards] = useState<any[]>([]);
  const [tcgTotalCount, setTcgTotalCount] = useState(0);
  const tcgSentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: pokemon, isLoading: loadingPokemon, error } = trpc.pokemon.getDetail.useQuery(
    { id: pokemonId },
    { staleTime: 1000 * 60 * 60 }
  );

  const { data: tcgData, isLoading: loadingTCG, isFetching: fetchingTCG } = trpc.pokemon.getTCGCards.useQuery(
    { name: pokemon?.name ?? "", page: tcgPage, pageSize: 24 },
    { enabled: !!pokemon?.name, staleTime: 1000 * 60 * 10 }
  );

  // Accumulate TCG cards across pages
  useEffect(() => {
    if (!tcgData) return;
    if (tcgPage === 1) {
      setAllTcgCards(tcgData.cards);
    } else {
      setAllTcgCards(prev => {
        const ids = new Set(prev.map((c: any) => c.id));
        return [...prev, ...tcgData.cards.filter((c: any) => !ids.has(c.id))];
      });
    }
    setTcgTotalCount(tcgData.totalCount);
  }, [tcgData, tcgPage]);

  // Reset when pokemon changes
  useEffect(() => {
    setTcgPage(1);
    setAllTcgCards([]);
  }, [pokemonId]);

  const tcgHasMore = allTcgCards.length < tcgTotalCount;

  // IntersectionObserver for TCG cards
  useEffect(() => {
    const el = tcgSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && tcgHasMore && !fetchingTCG) {
          setTcgPage(p => p + 1);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tcgHasMore, fetchingTCG]);

  const primaryType = pokemon?.types[0] ?? "normal";
  const typeStyle = TYPE_COLORS[primaryType] ?? TYPE_COLORS.normal;

  const totalStats = useMemo(
    () => pokemon?.stats.reduce((sum, s) => sum + s.value, 0) ?? 0,
    [pokemon?.stats]
  );

  if (loadingPokemon) return <PokemonDetailSkeleton />;

  if (error || !pokemon) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">😵</p>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Pokémon not found</h2>
          <p className="text-gray-500 mb-6">We couldn't find "{pokemonId}" in the Pokédex.</p>
          <Link href="/pokedex">
            <Button variant="default">← Back to Pokédex</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/pokedex" className="hover:text-blue-600 transition-colors">Pokédex</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-800 font-medium">{capitalize(pokemon.name)}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* ─── Featured Cards Carousel ──────────────────────────────────────── */}
        {tcgData && tcgData.cards.length > 0 && (
          <FeaturedCardsCarousel
            cards={tcgData.cards}
            pokemonName={pokemon.name}
            typeStyle={typeStyle}
          />
        )}
        {loadingTCG && (
          <div className={`rounded-2xl border overflow-hidden shadow-sm ${typeStyle.border}`}>
            <div className={`px-5 py-3 ${typeStyle.bg}`}>
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="bg-white p-4 flex gap-4">
              <Skeleton className="w-40 h-64 rounded-xl flex-shrink-0" />
              <div className="flex-1 grid grid-cols-4 md:grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            </div>
          </div>
        )}

        {/* ─── Hero Section ─────────────────────────────────────────────────── */}
        <div className={`rounded-2xl shadow-sm border overflow-hidden ${typeStyle.border} ${typeStyle.bg}`}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Artwork */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <div className="relative w-56 h-56 md:w-64 md:h-64">
                  <img
                    src={showShiny ? pokemon.sprites.shiny : pokemon.sprites.official}
                    alt={pokemon.name}
                    className="w-full h-full object-contain drop-shadow-2xl transition-all duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = pokemon.sprites.front; }}
                  />
                  {(pokemon.isLegendary || pokemon.isMythical) && (
                    <div className="absolute -top-2 -right-2">
                      <Star className="w-7 h-7 text-yellow-500 fill-yellow-400 drop-shadow" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowShiny(!showShiny)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    showShiny
                      ? "bg-yellow-400 text-yellow-900 border-yellow-400"
                      : `border-current ${typeStyle.text} hover:bg-white/50`
                  }`}
                >
                  ✨ {showShiny ? "Normal" : "Shiny"}
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-sm font-mono font-bold ${typeStyle.text}`}>{formatId(pokemon.id)}</span>
                  {pokemon.isLegendary && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Legendary</Badge>}
                  {pokemon.isMythical && <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Mythical</Badge>}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1">
                  {capitalize(pokemon.name)}
                </h1>
                <p className={`text-sm font-medium mb-3 ${typeStyle.text}`}>{pokemon.genus}</p>

                {/* Types */}
                <div className="flex gap-2 mb-4">
                  {pokemon.types.map((type) => {
                    const ts = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
                    return (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${ts.bg} ${ts.text} ${ts.border}`}
                      >
                        <TypeIcon type={type} size={18} />
                        {capitalize(type)}
                      </span>
                    );
                  })}
                </div>

                {/* Flavor text */}
                {pokemon.flavorText && (
                  <p className="text-gray-600 text-sm leading-relaxed mb-5 italic border-l-4 border-current pl-3 opacity-80">
                    "{pokemon.flavorText}"
                  </p>
                )}

                {/* Quick stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Height", value: formatHeight(pokemon.height) },
                    { label: "Weight", value: formatWeight(pokemon.weight) },
                    { label: "Generation", value: `Gen ${pokemon.generation}` },
                    { label: "Growth Rate", value: capitalize(pokemon.growthRate) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/70 rounded-xl p-3 border border-white/80">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs: Stats / Evolution / Abilities / TCG Cards ─────────────── */}
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="w-full bg-white border border-gray-200 rounded-xl p-1 h-auto flex gap-1 shadow-sm">
            {[
              { value: "stats",     label: "Base Stats",       icon: <TrendingUp className="w-4 h-4" /> },
              { value: "evolution", label: "Evolution Chain",  icon: <ArrowRight className="w-4 h-4" /> },
              { value: "abilities", label: "Abilities",        icon: <Zap className="w-4 h-4" /> },
              { value: "cards",     label: "TCG Cards",        icon: <BookOpen className="w-4 h-4" /> },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Base Stats ── */}
          <TabsContent value="stats" className="mt-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Base Statistics</h2>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-2xl font-extrabold text-blue-600">{totalStats}</p>
                </div>
              </div>
              <div className="space-y-4">
                {pokemon.stats.map((stat) => {
                  const cfg = STAT_CONFIG[stat.name] ?? { label: capitalize(stat.name), icon: null, color: "bg-gray-400" };
                  const pct = Math.min((stat.value / 255) * 100, 100);
                  return (
                    <div key={stat.name} className="flex items-center gap-4">
                      <div className="w-28 flex items-center gap-1.5 text-xs font-medium text-gray-600 flex-shrink-0">
                        <span className="text-gray-400">{cfg.icon}</span>
                        {cfg.label}
                      </div>
                      <div className="w-10 text-right text-sm font-bold text-gray-800 flex-shrink-0">
                        {stat.value}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${cfg.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-8 text-xs text-gray-400 flex-shrink-0">255</div>
                    </div>
                  );
                })}
              </div>

              {/* Extra info */}
              <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Capture Rate", value: `${pokemon.captureRate}/255` },
                  { label: "Base Happiness", value: `${pokemon.baseHappiness}/255` },
                  { label: "Base EXP", value: pokemon.baseExperience ?? "—" },
                  { label: "Egg Groups", value: pokemon.eggGroups.map(capitalize).join(", ") || "—" },
                  { label: "Color", value: capitalize(pokemon.color) },
                  { label: "Growth Rate", value: capitalize(pokemon.growthRate) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Evolution Chain ── */}
          <TabsContent value="evolution" className="mt-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Evolution Chain</h2>
              {pokemon.evolutions.length <= 1 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🔒</p>
                  <p className="text-gray-500 font-medium">This Pokémon does not evolve.</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {pokemon.evolutions.map((evo, idx) => {
                    const isActive = evo.name === pokemon.name;
                    return (
                      <div key={evo.id} className="flex items-center gap-4">
                        {/* Evolution card */}
                        <Link href={`/pokedex/${evo.id}`}>
                          <div
                            className={`flex flex-col items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                              isActive
                                ? `${typeStyle.border} ${typeStyle.bg} shadow-md`
                                : "border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-blue-50"
                            }`}
                          >
                            <div className="w-24 h-24 relative">
                              <img
                                src={evo.sprite}
                                alt={evo.name}
                                className="w-full h-full object-contain drop-shadow-md"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/card-placeholder.svg"; }}
                              />
                              {isActive && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white" />
                              )}
                            </div>
                            <p className="text-sm font-bold text-gray-800 mt-2">{capitalize(evo.name)}</p>
                            <p className="text-xs text-gray-400 font-mono">{formatId(evo.id)}</p>
                          </div>
                        </Link>

                        {/* Arrow + condition */}
                        {idx < pokemon.evolutions.length - 1 && (
                          <div className="flex flex-col items-center gap-1 text-gray-400">
                            <ChevronRight className="w-6 h-6" />
                            {pokemon.evolutions[idx + 1]?.condition && (
                              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap capitalize max-w-[80px] text-center leading-tight">
                                {pokemon.evolutions[idx + 1]?.condition}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Abilities ── */}
          <TabsContent value="abilities" className="mt-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Abilities</h2>
              <div className="grid gap-4">
                {pokemon.abilities.map((ability) => (
                  <div
                    key={ability.name}
                    className={`p-4 rounded-xl border ${
                      ability.isHidden
                        ? "border-purple-200 bg-purple-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-4 h-4 ${ability.isHidden ? "text-purple-600" : "text-blue-600"}`} />
                      <p className="font-semibold text-gray-800 capitalize">{ability.name}</p>
                      {ability.isHidden && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Hidden</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {ability.description
                        ? ability.description
                        : ability.isHidden
                          ? "A hidden ability that can be obtained through special means."
                          : "A standard ability this Pokémon can have."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── TCG Cards ── */}
          <TabsContent value="cards" className="mt-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">TCG Cards</h2>
                  {tcgData && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {tcgData.totalCount} cards found for {capitalize(pokemon.name)}
                    </p>
                  )}
                </div>
                <Link href={`/cards?q=${encodeURIComponent(pokemon.name)}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    View All
                  </Button>
                </Link>
              </div>

              {loadingTCG ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="rounded-xl overflow-hidden">
                      <Skeleton className="h-48 w-full" />
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-7 w-full mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !tcgData || tcgData.cards.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">🃏</p>
                  <p className="text-gray-500 font-medium">No TCG cards found for {capitalize(pokemon.name)}.</p>
                  <Link href="/cards">
                    <Button variant="outline" className="mt-4">Browse All Cards</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {allTcgCards.map((card: any) => (
                      <TCGCardItem key={card.id} card={card} />
                    ))}
                  </div>

                  {/* Infinite scroll sentinel */}
                  <div ref={tcgSentinelRef} className="h-1" />

                  {fetchingTCG && tcgPage > 1 && (
                    <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading more cards…</span>
                    </div>
                  )}
                  {!tcgHasMore && allTcgCards.length > 0 && (
                    <p className="text-center py-4 text-sm text-gray-400">
                      All {tcgTotalCount} cards loaded
                    </p>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Navigation between Pokémon ──────────────────────────────────── */}
        <div className="flex gap-4">
          {pokemon.id > 1 && (
            <Link href={`/pokedex/${pokemon.id - 1}`} className="flex-1">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <ChevronRight className="w-5 h-5 rotate-180 text-gray-500 group-hover:text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Previous</p>
                  <p className="text-sm font-semibold text-gray-700">{formatId(pokemon.id - 1)}</p>
                </div>
              </div>
            </Link>
          )}
          {pokemon.id < 1025 && (
            <Link href={`/pokedex/${pokemon.id + 1}`} className="flex-1">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-end gap-3 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                <div>
                  <p className="text-xs text-gray-400 text-right">Next</p>
                  <p className="text-sm font-semibold text-gray-700">{formatId(pokemon.id + 1)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
