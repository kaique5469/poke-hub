import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { Search, Grid3X3, List, X, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { id: "all", label: "All Products", icon: "🛍️" },
  { id: "booster_box", label: "Booster Boxes", icon: "📦" },
  { id: "etb", label: "Elite Trainer Boxes", icon: "🎁" },
  { id: "booster_pack", label: "Booster Packs", icon: "⚡" },
  { id: "blister", label: "Blisters", icon: "🧃" },
  { id: "collector_box", label: "Collector Boxes", icon: "💎" },
  { id: "tin", label: "Tins", icon: "🥫" },
  { id: "sleeves", label: "Sleeves", icon: "🃏" },
  { id: "deck_box", label: "Deck Boxes", icon: "🗃️" },
  { id: "playmat", label: "Playmats", icon: "🟦" },
  { id: "binder_portfolio", label: "Binders", icon: "📔" },
  { id: "damage_counter", label: "Counters & Dice", icon: "🎲" },
];

const SORTS: Array<[string, string]> = [
  ["newest", "Newest"],
  ["price_asc", "Price: Low to High"],
  ["price_desc", "Price: High to Low"],
  ["views", "Most Viewed"],
];

interface ProductRow {
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
}

const catLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label ?? id;

function ProductCard({ product, view }: { product: ProductRow; view: "grid" | "list" }) {
  const [imgError, setImgError] = useState(false);
  const price = product.avgPriceUsd ?? product.minPriceUsd;

  const img = !imgError && product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} loading="lazy"
      className="w-full h-full object-contain p-2" onError={() => setImgError(true)} />
  ) : (
    <Package className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
  );

  if (view === "list") {
    return (
      <Link href={`/shop/${product.slug}`}
        className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all">
        <div className="w-20 h-20 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">{img}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm line-clamp-1" style={{ color: "oklch(0.18 0.02 240)" }}>{product.name}</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>
            {product.setName ?? catLabel(product.category)}
          </p>
        </div>
        <div className="text-right shrink-0">
          {price && <div className="price-tag">${Number(price).toFixed(2)}</div>}
          <div className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>reference price</div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/shop/${product.slug}`} className="product-card">
      <div className="product-card-img relative">
        <span className="absolute top-2 left-2 badge badge-blue">{catLabel(product.category)}</span>
        {img}
      </div>
      <div className="product-card-body">
        <p className="text-xs font-semibold mb-1" style={{ color: "oklch(0.52 0.015 240)" }}>
          {product.setName ?? "Accessory"}
        </p>
        <p className="text-sm font-bold mb-2 line-clamp-2" style={{ color: "oklch(0.18 0.02 240)" }}>{product.name}</p>
        <div className="flex items-center gap-2 mt-auto">
          {price && <span className="price-tag">${Number(price).toFixed(2)}</span>}
          <span className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>ref.</span>
        </div>
      </div>
    </Link>
  );
}

export default function Shop() {
  usePageMeta("Shop", "Buy sealed Pokémon TCG products — booster boxes, ETBs, tins and accessories from verified sellers.");
  const urlCat = new URLSearchParams(window.location.search).get("cat");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(urlCat && CATEGORIES.some(c => c.id === urlCat) ? urlCat : "all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "views">("newest");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.products.list.useQuery({
    q: search.trim() || undefined,
    category: activeCategory === "all" ? undefined : activeCategory,
    sort,
    page,
    pageSize: 24,
  });

  const items = (data?.items ?? []) as ProductRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 24));

  const resetAnd = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="page-header">
        <div className="container">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>Shop</h1>
              <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>
                Sealed products & accessories sold by the community
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView("grid")} className={cn("page-btn", view === "grid" && "active")} aria-label="Grid view"><Grid3X3 className="w-4 h-4" /></button>
              <button onClick={() => setView("list")} className={cn("page-btn", view === "list" && "active")} aria-label="List view"><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="tab-list overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => resetAnd(() => setActiveCategory(cat.id))}
              className={cn("tab-item whitespace-nowrap flex items-center gap-1.5", activeCategory === cat.id && "active")}>
              <span>{cat.icon}</span>{cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          <aside className="w-56 shrink-0 space-y-4 hidden lg:block">
            <div className="filter-sidebar">
              <div className="filter-section-title"><Search className="w-4 h-4" style={{ color: "oklch(0.54 0.25 293)" }} />Search</div>
              <div className="search-bar">
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.62 0.01 240)" }} />
                <input value={search} onChange={e => resetAnd(() => setSearch(e.target.value))}
                  placeholder="Product name..." className="flex-1 text-sm" />
                {search && <button onClick={() => resetAnd(() => setSearch(""))}><X className="w-3.5 h-3.5" style={{ color: "oklch(0.62 0.01 240)" }} /></button>}
              </div>
            </div>

            <div className="filter-sidebar">
              <div className="filter-section-title">Sort By<div className="h-px flex-1" style={{ background: "oklch(0.88 0.01 240)" }} /></div>
              <div className="space-y-0.5">
                {SORTS.map(([v, l]) => (
                  <button key={v} onClick={() => resetAnd(() => setSort(v as typeof sort))}
                    className={cn("filter-option w-full", sort === v && "active")}>{l}</button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <p className="text-sm font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>
                {isLoading ? "Loading…" : `${total} products`}
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <span className="text-6xl">🔍</span>
                <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>No products found</p>
                <button onClick={() => { setSearch(""); setActiveCategory("all"); setPage(1); }} className="btn-primary mt-4">Clear Filters</button>
              </div>
            ) : (
              <>
                <div className={cn(view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" : "flex flex-col gap-3")}>
                  {items.map(p => <ProductCard key={p.id} product={p} view={view} />)}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="page-btn disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-bold px-3" style={{ color: "oklch(0.35 0.02 240)" }}>
                      {page} / {totalPages}
                    </span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      className="page-btn disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
