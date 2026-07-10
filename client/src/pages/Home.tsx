import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ChevronRight, ChevronLeft, TrendingUp, Zap, Package,
  Trophy, Star, ArrowRight, Clock, Eye,
  BarChart2, Users, BookOpen, Newspaper, Sparkles,
  CalendarDays, Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SectionIcon({ from, to, children }: { from: string; to: string; children: React.ReactNode }) {
  return (
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {children}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

function timeLeft(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Static TCG News (curated, updated periodically) ─────────────────────────
const tcgNews = [
  {
    id: "n1",
    title: "Scarlet & Violet — Stellar Crown Now Available",
    excerpt: "The latest expansion introduces new Stellar Tera Pokémon ex and powerful Supporter cards that are already shaking up the Standard format.",
    category: "New Release",
    categoryColor: "#e94560",
    date: "2024-09-13",
    image: "https://images.pokemontcg.io/sv7/logo.png",
    href: "/cards?set=sv7",
    pokemonArt: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png",
  },
  {
    id: "n2",
    title: "NAIC 2026 Decklists Released — Dragapult ex Dominates",
    excerpt: "North America International Championship results are in. Dragapult ex took 49% of the top 32 slots, with Raging Bolt and Regidrago close behind.",
    category: "Tournament",
    categoryColor: "#8b5cf6",
    date: "2026-06-28",
    image: null,
    href: "/metagame",
    pokemonArt: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/887.png",
  },
  {
    id: "n3",
    title: "Prismatic Evolutions — Eevee Tera Illustration Rares Hit $400+",
    excerpt: "The Eevee Tera Special Illustration Rare from Prismatic Evolutions continues to climb, now averaging $420 on TCGPlayer with no signs of slowing.",
    category: "Market Watch",
    categoryColor: "#10b981",
    date: "2026-07-01",
    image: null,
    href: "/cards?set=sv8pt5",
    pokemonArt: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png",
  },
  {
    id: "n4",
    title: "Worlds 2026 — Honolulu, Hawaii Announced",
    excerpt: "The Pokémon Company confirmed the 2026 World Championships will be held in Honolulu, Hawaii from August 15–17. Registration opens July 10.",
    category: "Event",
    categoryColor: "#f59e0b",
    date: "2026-06-15",
    image: null,
    href: "/tournaments",
    pokemonArt: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/249.png",
  },
];

// ─── Hero: rotating banner with art — new sets, hot cards & fresh articles ────
interface HeroSlide {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  bg: string;
  cta: string;
  href: string;
  logo: string | null;
  /** Large art rendered on the right side of the banner */
  art?: string | null;
  artStyle?: "card" | "square" | "pokemon";
  /** Collage art on the left/right edges: [left, right] */
  sideArt?: [string | null, string | null];
}

function HeroSection({ newestSet, articles, hotCard }: { newestSet: any; articles?: any[]; hotCard?: any }) {
  const [current, setCurrent] = useState(0);

  const slides = useMemo(() => {
    const base: HeroSlide[] = [
      {
        title: newestSet ? `New Set: ${newestSet.name}` : "TCG Arena — Trade. Collect. Compete.",
        subtitle: newestSet
          ? `Released ${formatDate(newestSet.releaseDate)} · ${newestSet.total} cards · ${newestSet.series}`
          : "The card game marketplace where collectors compete.",
        badge: newestSet ? "New Release" : "Welcome to the Arena",
        badgeColor: "#7C3AED",
        bg: "linear-gradient(135deg, #0B1220 0%, #2b1a55 55%, #5B21B6 100%)",
        cta: "Browse Cards",
        href: newestSet ? `/cards?set=${newestSet.id}` : "/cards",
        logo: newestSet?.images?.logo ?? null,
        art: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png",
        artStyle: "pokemon",
        sideArt: [
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/658.png",
        ],
      },
    ];

    // Guess Game promo slide
    base.push({
      title: "New Game: Guess the Pokémon",
      subtitle: "15 tries to find the hidden Pokémon. Earn points, build streaks and climb the arena leaderboard!",
      badge: "New Minigame",
      badgeColor: "#FF2E9A",
      bg: "linear-gradient(135deg, #0B1220 0%, #3b0f3f 55%, #86198f 100%)",
      cta: "Play Now",
      href: "/game",
      logo: null,
      art: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/132.png",
      artStyle: "pokemon",
      sideArt: [
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/92.png",
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/39.png",
      ],
    });

    // Hot card slide (Special Illustration Rare art)
    if (hotCard) {
      base.push({
        title: hotCard.name,
        subtitle: Number(hotCard.price ?? 0) > 0
          ? `${hotCard.set ?? "Chase card"} · trending at $${Number(hotCard.price).toFixed(2)} — track it, trade it, or grab it now.`
          : `${hotCard.set ?? "Chase card"} · the chase card everyone wants — track it, trade it, or grab it now.`,
        badge: "Hot Card",
        badgeColor: "#e94560",
        bg: "linear-gradient(135deg, #0B1220 0%, #451a55 55%, #7C3AED 100%)",
        cta: "View Card",
        href: `/cards/${hotCard.id}`,
        logo: null,
        art: hotCard.image ?? null,
        artStyle: "card",
        sideArt: [hotCard.image ?? null, hotCard.image ?? null],
      });
    }

    // Featured articles only — major news earns the hero banner (tag "featured")
    const featuredArticles = (articles ?? []).filter(
      (a) => Array.isArray(a.tags) && a.tags.includes("featured"),
    );
    for (const a of featuredArticles.slice(0, 2)) {
      base.push({
        title: a.title,
        subtitle: a.subtitle ?? "Fresh from the TCG Arena newsroom — strategy, market watch and set reviews.",
        badge: "Breaking News",
        badgeColor: "#8b5cf6",
        bg: "linear-gradient(135deg, #150a2e 0%, #2b1a55 55%, #4c2a8a 100%)",
        cta: "Read Article",
        href: `/articles/${a.slug}`,
        logo: null,
        art: a.coverImageUrl ?? null,
        artStyle: "square",
      });
    }

    base.push(
      {
        title: "Live Card Auctions",
        subtitle: "Bid on rare holos, PSA graded cards, and sealed vintage products every day.",
        badge: "Live Now",
        badgeColor: "#f59e0b",
        bg: "linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #7a3500 100%)",
        cta: "View Auctions",
        href: "/auctions",
        logo: null,
        art: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
        artStyle: "pokemon",
        sideArt: [
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/302.png",
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/778.png",
        ],
      },
      {
        title: "Build Your Championship Deck",
        subtitle: "Use our Deck Builder with live TCGPlayer prices to craft the perfect 60-card list.",
        badge: "Free Tool",
        badgeColor: "#7C3AED",
        bg: "linear-gradient(135deg, #0d1117 0%, #1a2744 50%, #2d4a8a 100%)",
        cta: "Build Now",
        href: "/deck-builder",
        logo: null,
        art: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/384.png",
        artStyle: "pokemon",
        sideArt: [
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/130.png",
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/445.png",
        ],
      },
    );
    return base;
  }, [newestSet, articles, hotCard]);

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[current];

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col shadow-lg"
      style={{ background: slide.bg, minHeight: "340px" }}
    >
      {/* Art stage (top) */}
      <div className="relative flex-1 min-h-[200px] overflow-hidden">
        {/* Side collage art */}
        {slide.sideArt?.[0] && (
          <img
            src={slide.sideArt[0]}
            alt=""
            loading="lazy"
            className={
              slide.artStyle === "card"
                ? "absolute left-[6%] -bottom-8 h-[95%] rounded-lg shadow-xl -rotate-12 opacity-70 z-0 hidden md:block"
                : "absolute left-[7%] bottom-0 h-[72%] object-contain drop-shadow-xl -rotate-6 opacity-85 z-0 hidden md:block"
            }
          />
        )}
        {slide.sideArt?.[1] && (
          <img
            src={slide.sideArt[1]}
            alt=""
            loading="lazy"
            className={
              slide.artStyle === "card"
                ? "absolute right-[6%] -bottom-8 h-[95%] rounded-lg shadow-xl rotate-12 opacity-70 z-0 hidden md:block"
                : "absolute right-[7%] bottom-0 h-[72%] object-contain drop-shadow-xl rotate-6 opacity-85 z-0 hidden md:block"
            }
          />
        )}
        {slide.art && (
          <img
            src={slide.art}
            alt=""
            loading="lazy"
            className={
              slide.artStyle === "card"
                ? "absolute left-1/2 -translate-x-1/2 -bottom-6 h-[115%] rounded-lg shadow-2xl rotate-3 z-0"
                : slide.artStyle === "pokemon"
                  ? "absolute left-1/2 -translate-x-1/2 bottom-0 h-[105%] object-contain drop-shadow-2xl z-0"
                  : "absolute inset-0 w-full h-full object-cover opacity-60 z-0 [mask-image:linear-gradient(to_top,transparent,black_35%)]"
            }
          />
        )}
        {/* Side glow accents */}
        <div
          className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-25 blur-3xl z-0"
          style={{ background: slide.badgeColor }}
        />
        <div
          className="absolute -right-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-25 blur-3xl z-0"
          style={{ background: slide.badgeColor }}
        />
        <Badge
          className="absolute top-4 left-4 text-xs font-bold px-3 py-1 z-10"
          style={{ background: slide.badgeColor, color: "white", border: "none" }}
        >
          {slide.badge}
        </Badge>
        {slide.logo && (
          <img
            src={slide.logo}
            alt=""
            className="absolute top-4 right-4 h-10 object-contain max-w-[160px] z-10"
          />
        )}
        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-white" : "w-2 bg-white/40"}`}
            />
          ))}
        </div>
      </div>

      {/* Title ribbon (Liga style) */}
      <div className="relative z-10 py-3 px-14 text-center" style={{ background: slide.badgeColor }}>
        <h1
          className="text-lg md:text-2xl font-black text-white uppercase tracking-wide leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {slide.title}
        </h1>
      </div>

      {/* Subtitle band */}
      <div
        className="relative z-10 py-3 px-14 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center"
        style={{
          background: `linear-gradient(90deg, ${slide.badgeColor}26 0%, #ffffff 30%, #ffffff 70%, ${slide.badgeColor}26 100%)`,
          borderBottom: `3px solid ${slide.badgeColor}`,
        }}
      >
        <p className="text-gray-800 text-xs md:text-sm font-semibold">{slide.subtitle}</p>
        <Link href={slide.href}>
          <Button
            size="sm"
            className="rounded-full font-bold text-white shrink-0 h-7 px-4 text-xs"
            style={{ background: slide.badgeColor, border: "none" }}
          >
            {slide.cta} <ArrowRight size={13} className="ml-1.5" />
          </Button>
        </Link>
      </div>

      {/* Nav arrows */}
      <button
        onClick={() => setCurrent(c => (c - 1 + slides.length) % slides.length)}
        className="absolute left-3 top-[35%] w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white z-20 transition-colors"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => setCurrent(c => (c + 1) % slides.length)}
        className="absolute right-3 top-[35%] w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white z-20 transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: recentSets, isLoading: loadingSets } = trpc.sets.recent.useQuery(
    { limit: 8 },
    { staleTime: 30 * 60 * 1000, retry: false }
  );

  const { data: highValueCards, isLoading: loadingHighValue } = trpc.cards.getHighValue.useQuery(
    { page: 1 },
    { staleTime: 15 * 60 * 1000, retry: false }
  );

  const { data: articles, isLoading: loadingArticles } = trpc.articles.list.useQuery(
    { limit: 4 },
    { staleTime: 5 * 60 * 1000, retry: false }
  );

  const { data: topDecks, isLoading: loadingDecks } = trpc.metagame.topDecks.useQuery(
    {},
    { staleTime: 10 * 60 * 1000, retry: false }
  );

  const { data: liveAuctions } = trpc.auctions.list.useQuery(
    { sort: "ending_soon", limit: 4 },
    { staleTime: 60 * 1000, retry: false }
  );

  const { data: upcomingTournaments } = trpc.tournaments.upcoming.useQuery(
    undefined,
    { staleTime: 10 * 60 * 1000, retry: false }
  );

  const newestSet = recentSets?.[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-6 space-y-8">

        {/* ─── Hero ───────────────────────────────────────────────────────── */}
        <HeroSection
          newestSet={newestSet}
          articles={articles as any[] | undefined}
          hotCard={(() => {
            const c: any = (highValueCards as any)?.data?.[0];
            if (!c) return null;
            return {
              id: c.id,
              name: c.name,
              set: c.set?.name,
              image: c.images?.large ?? c.images?.small ?? null,
              price: c.tcgplayer?.prices
                ? Object.values(c.tcgplayer.prices as Record<string, any>)[0]?.market ?? 0
                : 0,
            };
          })()}
        />

        {/* ─── New Sets ──────────────────────────────────────────────────── */}
        <div>
          <div className="section-header">
            <h2 className="section-title">
              <SectionIcon from="#7C3AED" to="#5B21B6"><Package size={14} /></SectionIcon>
              New Sets
            </h2>
            <Link href="/sets" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              All Sets <ArrowRight size={14} />
            </Link>
          </div>

          {loadingSets ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(recentSets ?? []).slice(0, 8).map((set: any, idx: number) => (
                <Link key={set.id} href={`/cards?set=${set.id}`}>
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-violet-200 hover:shadow-md transition-all group">
                    {/* Featured card art strip */}
                    <div className="relative h-28 bg-gradient-to-br from-gray-900 to-gray-700 overflow-hidden">
                      {set.featuredCards?.length > 0 ? (
                        <div className="flex h-full items-end justify-center gap-1 px-2 pb-1">
                          {set.featuredCards.slice(0, 3).map((fc: any, fi: number) => (
                            <img
                              key={fc.id}
                              src={fc.image}
                              alt={fc.name}
                              className="h-24 object-contain drop-shadow-lg transition-transform group-hover:scale-105"
                              style={{
                                zIndex: fi + 1,
                                marginLeft: fi > 0 ? "-20px" : "0",
                                transform: fi === 1 ? "translateY(-4px)" : "none",
                              }}
                              loading="lazy"
                            />
                          ))}
                          {/* Set logo overlay bottom-right */}
                          {set.images?.logo && (
                            <img
                              src={set.images.logo}
                              alt=""
                              className="absolute bottom-1 right-2 h-5 object-contain opacity-70"
                              loading="lazy"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <img
                            src={set.images?.logo}
                            alt={set.name}
                            className="max-h-16 max-w-[80%] object-contain opacity-60"
                            loading="lazy"
                          />
                        </div>
                      )}
                      {idx === 0 && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          NEW
                        </div>
                      )}
                    </div>

                    {/* Set info */}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <img
                          src={set.images?.symbol}
                          alt=""
                          className="w-4 h-4 object-contain"
                          loading="lazy"
                        />
                        <span className="text-[10px] text-gray-400 font-medium truncate">{set.series}</span>
                      </div>
                      <div className="font-bold text-gray-800 text-xs leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                        {set.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <CalendarDays size={10} />
                          {formatDate(set.releaseDate)}
                        </span>
                        <span className="text-[10px] font-bold text-primary">{set.total} cards</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ─── TCG News + Featured Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* TCG News Feed */}
          <div className="lg:col-span-2">
            <div className="section-header">
              <h2 className="section-title">
                <SectionIcon from="#FF2E9A" to="#be185d"><Newspaper size={14} /></SectionIcon>
                TCG News
              </h2>
              <Link href="/articles" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                All News <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {/* Top story — large card */}
              {(() => {
                const top = tcgNews[0];
                return (
                  <Link href={top.href}>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-violet-200 hover:shadow-md transition-all group">
                      <div className="flex">
                        {/* Pokémon art side */}
                        <div className="w-28 shrink-0 bg-gradient-to-br from-[#0B1220] to-[#3b2a6d] flex items-end justify-center overflow-hidden">
                          <img
                            src={top.pokemonArt}
                            alt=""
                            className="w-24 h-24 object-contain drop-shadow-xl group-hover:scale-110 transition-transform"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ background: top.categoryColor }}
                            >
                              {top.category}
                            </span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock size={10} />
                              {formatDate(top.date)}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
                            {top.title}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-2">{top.excerpt}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })()}

              {/* Smaller news items */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tcgNews.slice(1).map(news => (
                  <Link key={news.id} href={news.href}>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-violet-200 hover:shadow-md transition-all group h-full">
                      {/* Pokémon art header */}
                      <div className="h-20 bg-gradient-to-br from-gray-800 to-gray-700 flex items-end justify-center overflow-hidden">
                        <img
                          src={news.pokemonArt}
                          alt=""
                          className="h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ background: news.categoryColor }}
                          >
                            {news.category}
                          </span>
                          <span className="text-[9px] text-gray-400">{formatDate(news.date)}</span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-xs leading-tight group-hover:text-primary transition-colors line-clamp-3">
                          {news.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Featured High-Value Cards */}
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <SectionIcon from="#F5B301" to="#d97706"><Sparkles size={14} /></SectionIcon>
                Hot Cards
              </h2>
              <Link href="/cards?rarity=Special+Illustration+Rare" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {loadingHighValue ? (
                <div className="p-4 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-10 h-14 rounded" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-14" />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {(highValueCards?.data ?? []).slice(0, 7).map((card: any, i: number) => {
                    const price =
                      card.tcgplayer?.prices?.holofoil?.market ??
                      card.tcgplayer?.prices?.["1stEditionHolofoil"]?.market ??
                      card.tcgplayer?.prices?.normal?.market;
                    return (
                      <Link key={card.id} href={`/cards/${card.id}`}>
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-yellow-50 transition-colors border-b border-gray-50 last:border-0 group">
                          <span className="text-xs font-bold text-gray-300 w-4 text-center shrink-0">{i + 1}</span>
                          <img
                            src={card.images?.small}
                            alt={card.name}
                            className="w-9 h-12 object-contain rounded shrink-0"
                            loading="lazy"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-800 group-hover:text-primary transition-colors truncate">
                              {card.name}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">{card.set?.name}</div>
                            {card.rarity && (
                              <span className="text-[9px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">
                                {card.rarity}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {price ? (
                              <>
                                <div className="text-sm font-black text-green-600">${price.toFixed(2)}</div>
                                <div className="text-[10px] text-gray-400">market</div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Guess Game Promo ──────────────────────────────────────────── */}
        <Link href="/game">
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg"
            style={{ background: "linear-gradient(120deg, #7C3AED 0%, #a21caf 55%, #FF2E9A 100%)" }}
          >
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/132.png" alt="" loading="lazy" className="absolute right-4 md:right-16 bottom-0 h-[92%] object-contain drop-shadow-2xl opacity-95 group-hover:scale-105 transition-transform hidden sm:block" />
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/92.png" alt="" loading="lazy" className="absolute right-[26%] -bottom-2 h-[62%] object-contain opacity-50 hidden md:block" />
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/39.png" alt="" loading="lazy" className="absolute -left-6 -bottom-6 h-[70%] object-contain opacity-20" />
            <div className="relative z-10 p-7 md:p-9 max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-white/20 text-white rounded-full px-3 py-1 mb-3">
                <Gamepad2 size={13} /> New Minigame
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
                Guess the Pokémon
              </h2>
              <p className="text-white/85 text-sm md:text-base mb-4">
                A hidden Pokémon awaits. You get 15 tries — warmth hints show if you're close. Win points, keep your streak and top the arena leaderboard!
              </p>
              <span className="inline-flex items-center gap-2 bg-white text-fuchsia-700 font-black text-sm rounded-full px-6 py-2.5 group-hover:scale-105 transition-transform">
                <Gamepad2 size={16} /> Play Now — It's Free
              </span>
            </div>
          </div>
        </Link>

        {/* ─── Live Auctions ─────────────────────────────────────────────── */}
        {liveAuctions && liveAuctions.length > 0 && (
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <SectionIcon from="#F5B301" to="#b45309"><Zap size={14} /></SectionIcon>
                Live Auctions
              </h2>
              <Link href="/auctions" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                All Auctions <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {liveAuctions.slice(0, 4).map((a: any) => (
                <Link key={a.id} href="/auctions">
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-violet-200 hover:shadow-md transition-all group h-full">
                    <div className="relative h-36 bg-gradient-to-br from-[#0B1220] to-[#3b2a6d] flex items-center justify-center overflow-hidden p-3">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.title} className="h-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <Zap size={32} className="text-white/30" />
                      )}
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock size={9} /> {timeLeft(a.endsAt)}
                      </div>
                      {a.isFoil && (
                        <div className="absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full text-black" style={{ background: "#F5B301" }}>
                          FOIL
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-gray-800 text-xs leading-tight line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
                        {a.title}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-black text-green-600">
                            ${Number(a.currentBidUsd ?? a.startingBidUsd ?? 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400">{a.bidCount ?? 0} bids</div>
                        </div>
                        <Badge className="text-[9px] font-bold" style={{ background: "#7C3AED20", color: "#7C3AED", border: "none" }}>
                          {a.condition}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ─── Latest Articles ───────────────────────────────────────────── */}
        <div>
          <div className="section-header">
            <h2 className="section-title">
              <SectionIcon from="#00E5FF" to="#0284c7"><BookOpen size={14} /></SectionIcon>
              Latest Articles
            </h2>
            <Link href="/articles" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              All Articles <ArrowRight size={14} />
            </Link>
          </div>

          {loadingArticles ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : articles && articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {articles.map((article: any) => {
                // Pick a Pokémon art based on article tags or category
                const pokemonNum = article.tags?.includes("charizard") ? 6
                  : article.tags?.includes("pikachu") ? 25
                  : article.tags?.includes("mewtwo") ? 150
                  : article.tags?.includes("eevee") ? 133
                  : Math.floor(Math.random() * 150) + 1;
                return (
                  <Link key={article.id} href={`/articles/${article.slug}`}>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-violet-200 hover:shadow-md transition-all group h-full">
                      <div className="h-24 bg-gradient-to-br from-[#0B1220] to-[#4c2a8a] flex items-end justify-center overflow-hidden">
                        <img
                          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonNum}.png`}
                          alt=""
                          className="h-20 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3">
                        {article.category && (
                          <span className="text-[9px] font-bold text-primary bg-violet-50 px-1.5 py-0.5 rounded-full">
                            {article.category}
                          </span>
                        )}
                        <h3 className="font-bold text-gray-800 text-xs mt-1.5 mb-1 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                          {article.title}
                        </h3>
                        {article.subtitle && (
                          <p className="text-[10px] text-gray-500 line-clamp-2 mb-1">{article.subtitle}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock size={9} />
                            {article.publishedAt ? timeAgo(article.publishedAt) : timeAgo(article.createdAt)}
                          </span>
                          {article.viewCount != null && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Eye size={9} />
                              {article.viewCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No articles yet. Be the first to publish!</p>
              <Link href="/articles">
                <Button variant="outline" className="mt-3 text-xs">Browse Articles</Button>
              </Link>
            </div>
          )}
        </div>

        {/* ─── Metagame + Tournaments ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Decks */}
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <SectionIcon from="#10b981" to="#047857"><BarChart2 size={14} /></SectionIcon>
                Top Decks
              </h2>
              <Link href="/metagame" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                Full Meta <ArrowRight size={14} />
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {loadingDecks ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-16" />
                      </div>
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {(topDecks ?? []).slice(0, 6).map((deck: any, i: number) => (
                    <Link key={deck.name} href={`/metagame?deck=${encodeURIComponent(deck.name)}`}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-0 group">
                        <span className="text-xs font-black text-gray-300 w-5 text-center">{i + 1}</span>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: `hsl(${i * 40}, 65%, 50%)` }}
                        >
                          {deck.name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors truncate">{deck.name}</div>
                          <div className="text-xs text-gray-400">{deck.format ?? "Standard"}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-green-600">{deck.sharePercent ?? deck.usage ?? "—"}%</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Tournaments */}
          <div>
            <div className="section-header">
              <h2 className="section-title">
                <SectionIcon from="#7C3AED" to="#FF2E9A"><Trophy size={14} /></SectionIcon>
                Upcoming Tournaments
              </h2>
              <Link href="/tournaments" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {(upcomingTournaments && upcomingTournaments.length > 0
                ? upcomingTournaments.slice(0, 4)
                : [
                    { id: "1", name: "NAIC 2026 — Indianapolis, IN", format: "Standard", date: "2026-07-20", location: "Indianapolis, IN" },
                    { id: "2", name: "Regional Championship — Dallas, TX", format: "Standard", date: "2026-08-15", location: "Dallas, TX" },
                    { id: "3", name: "League Cup — Los Angeles, CA", format: "Expanded", date: "2026-07-12", location: "Los Angeles, CA" },
                    { id: "4", name: "Worlds 2026 — Honolulu, HI", format: "Standard", date: "2026-08-15", location: "Honolulu, HI" },
                  ]
              ).map((t: any) => (
                <Link key={t.id} href={`/tournaments`}>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 poke-card hover:border-violet-200 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{t.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="text-[10px] font-bold" style={{ background: "#7C3AED20", color: "#7C3AED", border: "none" }}>
                            {t.format ?? "Standard"}
                          </Badge>
                          <span className="text-xs text-gray-400">{t.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <Clock size={12} />
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Stats Banner ──────────────────────────────────────────────── */}
        <div className="relative bg-white rounded-2xl border border-gray-100 p-6 overflow-hidden">
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="" loading="lazy"
            className="absolute -left-6 -bottom-8 h-36 opacity-10 pointer-events-none select-none" />
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png" alt="" loading="lazy"
            className="absolute -right-6 -bottom-8 h-36 opacity-10 pointer-events-none select-none" />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "15,000+", label: "Cards in Database", icon: <Star size={20} className="text-yellow-500" /> },
              { value: "1,200+", label: "Active Sellers", icon: <Users size={20} className="text-blue-500" /> },
              { value: "$2.4M+", label: "Cards Traded", icon: <TrendingUp size={20} className="text-green-500" /> },
              { value: "500+", label: "Tournaments Tracked", icon: <Trophy size={20} className="text-purple-500" /> },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                {stat.icon}
                <div className="text-2xl font-black text-gray-800" style={{ fontFamily: "var(--font-display)" }}>{stat.value}</div>
                <div className="text-xs text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
