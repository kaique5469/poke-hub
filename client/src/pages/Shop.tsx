import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  ["all", "All products"],
  ["booster_box", "Booster boxes"],
  ["etb", "Elite Trainer Boxes"],
  ["booster_pack", "Booster packs"],
  ["booster_bundle", "Booster bundles"],
  ["blister", "Blisters"],
  ["collector_box", "Collection boxes"],
  ["tin", "Tins"],
  ["battle_deck", "Battle decks"],
  ["sleeves", "Sleeves"],
  ["deck_box", "Deck boxes"],
  ["playmat", "Playmats"],
  ["binder_portfolio", "Binders"],
  ["damage_counter", "Counters & dice"],
] as const;
const SORTS = [
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["views", "Most viewed"],
] as const;
type Sort = (typeof SORTS)[number][0];

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  category: string;
  setName: string | null;
  minPriceUsd: string | null;
  avgPriceUsd: string | null;
  maxPriceUsd: string | null;
  viewCount: number;
};

const categoryLabel = (id: string) =>
  CATEGORIES.find(([value]) => value === id)?.[1] ?? id.replaceAll("_", " ");
const money = (value?: string | null) =>
  value ? `$${Number(value).toFixed(2)}` : null;

function ProductImage({
  product,
  className,
}: {
  product: ProductRow;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-gradient-to-b from-white to-gray-50",
        className
      )}
    >
      {!failed && product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="h-10 w-10 text-gray-300" />
      )}
    </div>
  );
}

function ProductCard({
  product,
  view,
}: {
  product: ProductRow;
  view: "grid" | "list";
}) {
  const reference = product.avgPriceUsd ?? product.minPriceUsd;
  const range =
    product.minPriceUsd && product.maxPriceUsd
      ? `${money(product.minPriceUsd)} – ${money(product.maxPriceUsd)}`
      : null;
  if (view === "list")
    return (
      <Link
        href={`/shop/${product.slug}`}
        className="group grid grid-cols-[88px_1fr_auto] items-center gap-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
      >
        <ProductImage product={product} className="h-20 w-20 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">
            {product.setName ?? categoryLabel(product.category)}
          </p>
          <h2 className="mt-1 truncate font-black text-gray-900">
            {product.name}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Official catalog image · USD market reference
          </p>
        </div>
        <div className="pr-2 text-right">
          <p className="text-lg font-black text-gray-900">
            {money(reference) ?? "Price unavailable"}
          </p>
          {range && (
            <p className="text-xs text-gray-500">Market range {range}</p>
          )}
        </div>
      </Link>
    );
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
    >
      <div className="relative">
        <ProductImage product={product} className="aspect-square w-full" />
        <span className="absolute left-3 top-3 rounded-full bg-gray-950/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          {categoryLabel(product.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">
          {product.setName ?? "Pokémon TCG"}
        </p>
        <h2 className="mt-1 line-clamp-2 min-h-10 text-sm font-black leading-5 text-gray-900">
          {product.name}
        </h2>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Market reference
            </p>
            <p className="text-lg font-black text-gray-950">
              {money(reference) ?? "—"}
            </p>
          </div>
          {range && (
            <p className="max-w-24 text-right text-[10px] leading-4 text-gray-500">
              Range
              <br />
              {range}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Shop() {
  usePageMeta(
    "Sealed Marketplace",
    "Explore real Pokémon TCG sealed products with official images and current USD market references."
  );
  const initial = new URLSearchParams(window.location.search);
  const initialCategory = initial.get("cat");
  const initialSort = initial.get("sort") as Sort | null;
  const [search, setSearch] = useState(initial.get("q") ?? "");
  const [setFilter, setSetFilter] = useState(initial.get("set"));
  const [category, setCategory] = useState(
    CATEGORIES.some(([id]) => id === initialCategory) ? initialCategory! : "all"
  );
  const [sort, setSort] = useState<Sort>(
    SORTS.some(([id]) => id === initialSort) ? initialSort! : "newest"
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (category !== "all") params.set("cat", category);
    if (setFilter) params.set("set", setFilter);
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    window.history.replaceState({}, "", query ? `/shop?${query}` : "/shop");
  }, [search, category, setFilter, sort]);

  const products = trpc.products.list.useQuery({
    q: search.trim() || undefined,
    category: category === "all" ? undefined : category,
    setId: setFilter ?? undefined,
    sort,
    page,
    pageSize: 24,
  });
  const catalogStatus = trpc.products.status.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const items = (products.data?.items ?? []) as ProductRow[];
  const total = products.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 24));
  const resetPage = (action: () => void) => {
    action();
    setPage(1);
  };
  const clear = () => {
    setSearch("");
    setCategory("all");
    setSetFilter(null);
    setSort("newest");
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="overflow-hidden bg-[#0b1020] text-white">
        <div className="container grid gap-8 py-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300">
              Verified sealed catalog
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">
              Find every box, bundle and Pokémon TCG product in one market.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Verified product names and imagery, USD market references and
              community listings—organized by set and product type.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="mt-3 font-black">Source-verified data</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Unverified seed products stay hidden.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Package className="h-5 w-5 text-violet-300" />
              <p className="mt-3 font-black">
                {total.toLocaleString()} products
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Search by product, category or set.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
              Buy from established retailers
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Search real stock while the community marketplace grows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              [
                "Pokémon Center",
                "https://www.pokemoncenter.com/category/trading-card-game",
              ],
              [
                "TCGplayer",
                "https://www.tcgplayer.com/categories/trading-and-collectible-card-games/pokemon",
              ],
              ["Target", "https://www.target.com/s?searchTerm=Pokemon%20TCG"],
              [
                "eBay",
                "https://www.ebay.com/sch/i.html?_nkw=Pokemon+TCG+sealed",
              ],
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-800 transition hover:border-violet-300 hover:text-violet-700"
              >
                {name} ↗
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="container py-8">
        <div className="sticky top-0 z-30 mb-6 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => resetPage(() => setSearch(e.target.value))}
                placeholder="Search booster box, ETB, bundle or set…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
              {search && (
                <button
                  onClick={() => resetPage(() => setSearch(""))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
              <SlidersHorizontal className="h-4 w-4 text-gray-400" />
              <select
                value={sort}
                onChange={e => resetPage(() => setSort(e.target.value as Sort))}
                className="min-w-44 bg-transparent py-2.5 text-sm font-bold text-gray-700 outline-none"
              >
                {SORTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex rounded-xl border border-gray-200 p-1">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "rounded-lg p-2",
                  view === "grid" ? "bg-gray-900 text-white" : "text-gray-500"
                )}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "rounded-lg p-2",
                  view === "list" ? "bg-gray-900 text-white" : "text-gray-500"
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(([id, label]) => (
              <button
                key={id}
                onClick={() => resetPage(() => setCategory(id))}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition",
                  category === id
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-600">
            {products.isLoading
              ? "Loading real catalog…"
              : `${total.toLocaleString()} real products found`}
          </p>
          {setFilter && (
            <button
              onClick={() => resetPage(() => setSetFilter(null))}
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-700"
            >
              Set {setFilter}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {products.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-[.72] rounded-2xl" />
            ))}
          </div>
        ) : products.isError ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-4 text-xl font-black text-gray-900">
              The catalog source is temporarily unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
              We did not substitute generated products. Use the trusted retailer
              links above or try the catalog again shortly.
            </p>
            <button
              onClick={() => products.refetch()}
              className="mt-5 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-black text-white"
            >
              Try again
            </button>
          </div>
        ) : !items.length ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-300" />
            <h2 className="mt-4 text-xl font-black text-gray-900">
              {search || category !== "all" || setFilter
                ? "No verified products matched these filters"
                : catalogStatus.data?.state === "syncing"
                  ? "Verified catalog is syncing"
                  : "No verified products are available yet"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {search || category !== "all" || setFilter
                ? "Try a broader product name or clear the category."
                : "Unverified products are hidden. You can still shop through the trusted retailer links above."}
            </p>
            {(search || category !== "all" || setFilter) && (
              <button
                onClick={clear}
                className="mt-5 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-black text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                view === "grid"
                  ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                  : "flex flex-col gap-3"
              )}
            >
              {items.map(product => (
                <ProductCard key={product.id} product={product} view={view} />
              ))}
            </div>
            {pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(value => value - 1)}
                  className="rounded-full border border-gray-200 bg-white p-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-black text-gray-600">
                  Page {page} of {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(value => value + 1)}
                  className="rounded-full border border-gray-200 bg-white p-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
