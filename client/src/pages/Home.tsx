import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
  const newestSet: any = sets.data?.[0];
  const heroCards = newestSet?.featuredCards?.slice(0, 3) ?? [];
  const highCards: any[] = (cards.data as any)?.data?.slice(0, 8) ?? [];
  const productRows: any[] = products.data?.items ?? [];
  const articleRows: any[] = articles.data ?? [];

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="relative overflow-hidden bg-[#0b1020] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(124,58,237,.32),transparent_34%),radial-gradient(circle_at_15%_90%,rgba(14,165,233,.18),transparent_30%)]" />
        <div className="container relative grid min-h-[560px] gap-10 py-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" /> The US Pokémon TCG market,
              organized
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.98] tracking-tight text-white md:text-7xl">
              Know the card.
              <br />
              <span className="text-violet-300">Know the market.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              Search English cards, compare live market references and discover
              every official sealed product connected to a set.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cards"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
              >
                Search cards <Search className="h-4 w-4" />
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Explore sealed products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="relative mx-auto min-h-[380px] w-full max-w-xl">
            <div className="absolute inset-x-10 bottom-0 top-12 rotate-2 rounded-[36px] border border-white/10 bg-white/5 backdrop-blur" />
            {heroCards.length ? (
              heroCards.map((card: any, index: number) => (
                <Link
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="absolute top-1/2 block w-[34%] -translate-y-1/2 transition hover:z-20 hover:-translate-y-[54%]"
                  style={{
                    left: `${8 + index * 27}%`,
                    transform: `translateY(-50%) rotate(${(index - 1) * 7}deg)`,
                    zIndex: index === 1 ? 3 : 2,
                  }}
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full drop-shadow-[0_28px_35px_rgba(0,0,0,.55)]"
                  />
                </Link>
              ))
            ) : (
              <div className="absolute inset-10 flex items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                <Boxes className="h-20 w-20 text-white/20" />
              </div>
            )}
            {newestSet && (
              <Link
                href={`/sets/${newestSet.id}`}
                className="absolute bottom-2 left-1/2 z-10 w-[86%] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#12182a]/95 p-4 shadow-2xl backdrop-blur"
              >
                <div className="flex items-center gap-4">
                  {newestSet.images?.logo && (
                    <img
                      src={newestSet.images.logo}
                      alt={newestSet.name}
                      className="h-12 w-24 object-contain"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">
                      Newest set
                    </p>
                    <p className="truncate text-base font-black text-white">
                      {newestSet.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {newestSet.total} cards ·{" "}
                      {shortDate(newestSet.releaseDate)}
                    </p>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 text-violet-300" />
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white">
        <div className="container grid divide-y divide-gray-100 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            [
              ShieldCheck,
              "Real marketplace data",
              "No fictional sealed catalog",
            ],
            [BarChart3, "Prices in USD", "Market references and seller offers"],
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
                    {set.featuredCards?.[0]?.image ? (
                      <img
                        src={set.featuredCards[0].image}
                        alt={set.featuredCards[0].name}
                        className="h-36 -rotate-3 object-contain drop-shadow-xl transition group-hover:rotate-0 group-hover:scale-105"
                      />
                    ) : (
                      <SafeImage
                        src={set.images?.logo}
                        alt={set.name}
                        className="max-h-20 w-full object-contain"
                      />
                    )}
                    {set.images?.logo && (
                      <img
                        src={set.images.logo}
                        alt=""
                        className="absolute bottom-2 right-2 h-7 w-20 object-contain"
                      />
                    )}
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
          ) : (
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
          )}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeading
              eyebrow="Market watch"
              title="Cards collectors are watching"
              href="/cards?tab=trends"
              link="Explore prices"
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
              eyebrow="TCG Arena editorial"
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
