import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  Gamepad2,
  Gift,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Skeleton } from "@/components/ui/skeleton";

const money = (value?: number | string | null) =>
  value != null ? `$${Number(value).toFixed(2)}` : "—";
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function SafeImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Package className="h-10 w-10 text-gray-300" />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export default function Home() {
  usePageMeta(
    "Pokémon TCG Marketplace & Price Guide",
    "Search English Pokémon cards, real sealed products, current USD prices, sets and collector news."
  );
  const sets = trpc.sets.recent.useQuery(
    { limit: 8 },
    { staleTime: 1_800_000, retry: false }
  );
  const products = trpc.products.list.useQuery(
    { sort: "views", page: 1, pageSize: 8 },
    { staleTime: 300_000, retry: false }
  );
  const cards = trpc.cards.getHighValue.useQuery(
    { page: 1 },
    { staleTime: 900_000, retry: false }
  );
  const articles = trpc.articles.list.useQuery(
    { limit: 7 },
    { staleTime: 300_000, retry: false }
  );
  const weekly = trpc.game.weeklyLeaderboard.useQuery(
    { limit: 3 },
    { staleTime: 60_000, retry: false }
  );
  const highCards: any[] = (cards.data as any)?.data?.slice(0, 8) ?? [];
  const productRows: any[] = products.data?.items ?? [];
  const articleRows: any[] = articles.data ?? [];

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="relative isolate overflow-hidden bg-[#090d1c] text-white">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/raritygrid-hero-v2.webp')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070b18] via-[#080d1ce8] to-[#0a0d1a70]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_60%_75%,rgba(124,58,237,.2),transparent_32%),linear-gradient(to_top,rgba(3,7,18,.58),transparent_45%)]" />
        <div className="container relative grid min-h-[600px] gap-10 py-16 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" /> Built for collectors, not
              clutter
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.98] tracking-tight text-white md:text-7xl">
              Collect smarter.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                Play for the top.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              Explore real cards and sealed products, follow the market and
              climb a new skill-based leaderboard every week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/game"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:bg-violet-500"
              >
                Play Weekly Arena <Gamepad2 className="h-4 w-4" />
              </Link>
              <Link
                href="/cards"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Search cards <Search className="h-4 w-4" />
              </Link>
              <Link
                href="/market"
                className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-300/10 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-300/20"
              >
                Open Market Pulse <BarChart3 className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Server-verified scoring
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-violet-300" />
                Fresh ranking every Monday
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl lg:pl-8">
            <div className="absolute -inset-5 rotate-2 rounded-[34px] border border-violet-300/10 bg-violet-400/5 blur-[1px]" />
            <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-[#0b1020d9] p-5 shadow-[0_35px_90px_rgba(0,0,0,.48)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-gray-950 shadow-lg shadow-amber-950/20">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">
                      RarityGrid Weekly Arena
                    </p>
                    <h2 className="mt-0.5 text-xl font-black text-white">
                      Guess. Score. Take #1.
                    </h2>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                  Live
                </span>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.055] p-4">
                <div className="flex items-start gap-3">
                  {weekly.data?.competition?.prizeImageUrl ? (
                    <img
                      src={weekly.data.competition.prizeImageUrl}
                      alt={weekly.data.competition.prizeTitle}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1"
                    />
                  ) : (
                    <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  )}
                  <div>
                    <p className="text-sm font-black text-white">
                      {weekly.data?.competition?.prizeTitle ??
                        "Weekly challenge leaderboard"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {weekly.data?.competition
                        ? "Prize eligibility covers the United States and Brazil. No purchase necessary. Official rules apply."
                        : "Prize rounds appear only after official rules and authorization are active."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[.18em] text-slate-500">
                  <span>Top this week</span>
                  <span>{weekly.data?.weekKey ?? "Weekly reset"}</span>
                </div>
                <div className="space-y-2">
                  {weekly.isLoading
                    ? [1, 2, 3].map(rank => (
                        <div
                          key={rank}
                          className="h-11 animate-pulse rounded-xl bg-white/[.06]"
                        />
                      ))
                    : (weekly.data?.rows ?? []).length
                      ? weekly.data!.rows.map((row: any, index: number) => (
                          <div
                            key={row.userId}
                            className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.045] px-3 py-2.5"
                          >
                            <span className="w-5 text-center text-sm font-black text-amber-300">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">
                              {row.name ?? row.username ?? "Trainer"}
                            </span>
                            <span className="text-sm font-black text-violet-300">
                              {row.points} pts
                            </span>
                          </div>
                        ))
                      : [
                          "Your name could be here",
                          "New week, clean slate",
                          "Play smart, not endlessly",
                        ].map((label, index) => (
                          <div
                            key={label}
                            className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.035] px-3 py-2.5"
                          >
                            <span className="w-5 text-center text-sm font-black text-slate-600">
                              {index + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-500">
                              {label}
                            </span>
                          </div>
                        ))}
                </div>
              </div>
              <Link
                href="/game"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-gray-950 transition hover:bg-violet-100"
              >
                Enter the arena <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white">
        <div className="container grid divide-y divide-gray-100 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            [
              ShieldCheck,
              "Verified-source catalog",
              "Unverified products remain hidden",
            ],
            [
              BarChart3,
              "Verified market signals",
              "Sources shown beside every metric",
            ],
            [BookOpen, "Fresh editorial", "Newest reporting shown first"],
          ].map(([Icon, title, text]) => (
            <div
              key={String(title)}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Icon className="h-5 w-5 shrink-0 text-violet-600" />
              <div>
                <p className="text-sm font-black text-gray-900">
                  {String(title)}
                </p>
                <p className="text-xs text-gray-500">{String(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="container space-y-14 py-12">
        <section>
          <SectionHeading
            eyebrow="Browse the catalog"
            title="Latest Pokémon TCG sets"
            href="/sets"
            link="View every set"
          />
          {sets.isLoading ? (
            <GridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(sets.data ?? []).map((set: any) => (
                <Link
                  key={set.id}
                  href={`/sets/${set.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
                >
                  <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-[#111827] to-[#312e81] p-4">
                    <SafeImage
                      src={set.images?.logo}
                      alt={set.name}
                      className="max-h-24 w-full object-contain transition group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">
                      {set.series}
                    </p>
                    <h3 className="mt-1 line-clamp-2 font-black text-gray-950">
                      {set.name}
                    </h3>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {shortDate(set.releaseDate)}
                      </span>
                      <span>{set.total} cards</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            eyebrow="Sealed market"
            title="Boxes, bundles and official products"
            href="/shop"
            link="Shop the full catalog"
          />
          {products.isLoading ? (
            <GridSkeleton />
          ) : productRows.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {productRows.map(product => (
                <Link
                  key={product.id}
                  href={`/shop/${product.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
                >
                  <div className="flex aspect-square items-center justify-center bg-gradient-to-b from-white to-gray-50 p-5">
                    <SafeImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-contain transition group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">
                      {product.setName ??
                        product.category?.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-black text-gray-950">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-end justify-between pt-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                          Market reference
                        </p>
                        <p className="text-lg font-black text-gray-950">
                          {money(product.avgPriceUsd ?? product.minPriceUsd)}
                        </p>
                      </div>
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
              <h3 className="mt-3 text-lg font-black text-gray-900">
                Verified sealed catalog is being refreshed
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
                We hide unverified products instead of showing generated boxes
                or prices. Trusted retailer shopping remains available in the
                shop.
              </p>
              <Link
                href="/shop"
                className="mt-5 inline-flex rounded-full bg-gray-950 px-5 py-2.5 text-sm font-black text-white"
              >
                Open trusted shopping links
              </Link>
            </div>
          )}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeading
              eyebrow="Market watch"
              title="Cards collectors are watching"
              href="/market"
              link="Open Market Pulse"
            />
            {cards.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-64 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {highCards.slice(0, 4).map(card => {
                  const prices: any = card.tcgplayer?.prices
                    ? Object.values(card.tcgplayer.prices)[0]
                    : null;
                  return (
                    <Link
                      key={card.id}
                      href={`/cards/${card.id}`}
                      className="group rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-violet-300 hover:shadow-lg"
                    >
                      <img
                        src={card.images?.small}
                        alt={card.name}
                        loading="lazy"
                        className="w-full rounded-lg transition group-hover:scale-[1.03]"
                      />
                      <p className="mt-3 truncate text-xs font-black text-gray-900">
                        {card.name}
                      </p>
                      <p className="mt-1 text-sm font-black text-emerald-700">
                        {money(prices?.market ?? prices?.mid)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <SectionHeading
              eyebrow="RarityGrid editorial"
              title="Latest stories and analysis"
              href="/articles"
              link="Read all articles"
            />
            <div className="space-y-3">
              {articles.isLoading
                ? Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                  ))
                : articleRows.slice(0, 4).map((article, index) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="group grid grid-cols-[96px_1fr] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-violet-300 hover:shadow-md"
                    >
                      <div className="flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 to-indigo-900">
                        <SafeImage
                          src={article.coverImageUrl}
                          alt={article.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-violet-600">
                          {index === 0 ? "Latest · " : ""}
                          {article.category?.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-gray-950 group-hover:text-violet-700">
                          {article.title}
                        </h3>
                        <p className="mt-1 text-[10px] font-bold text-gray-400">
                          {shortDate(article.publishedAt ?? article.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
  link,
}: {
  eyebrow: string;
  title: string;
  href: string;
  link: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950 md:text-3xl">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="hidden shrink-0 items-center gap-1 text-sm font-black text-violet-700 sm:inline-flex"
      >
        {link}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  );
}
