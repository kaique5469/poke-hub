import { useState, useEffect, useRef, useCallback } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { Clock, Search, Loader2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const CATEGORIES = ["All", "Competitive", "Budget", "Tournament", "Set Review", "Collecting", "News", "General"];
const CATEGORY_COLORS: Record<string, string> = {
  Competitive: "#ef4444", Budget: "#10b981", Tournament: "#8b5cf6",
  "Set Review": "#f59e0b", Collecting: "#3b82f6", News: "#0ea5e9", General: "#6b7280",
};
const BATCH = 20;

// Fallback card images by category
const CATEGORY_IMAGES: Record<string, string> = {
  Competitive: "https://images.pokemontcg.io/sv3/215_hires.png",
  Tournament: "https://images.pokemontcg.io/swsh11/186_hires.png",
  Budget: "https://images.pokemontcg.io/swsh7/215_hires.png",
  "Set Review": "https://images.pokemontcg.io/sv3/215_hires.png",
  Collecting: "https://images.pokemontcg.io/base1/4_hires.png",
  News: "https://images.pokemontcg.io/swsh7/218_hires.png",
  General: "https://images.pokemontcg.io/swsh7/218_hires.png",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Articles() {
  usePageMeta("Articles", "News, guides and strategy articles for the Pokémon TCG.");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch all articles from DB (limit 100 — more than enough for infinite scroll)
  const { data: articles, isLoading } = trpc.articles.list.useQuery(
    { category: category === "All" ? undefined : category, limit: 100 },
    { staleTime: 1000 * 60 * 5 }
  );

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(BATCH); }, [search, category]);

  const filtered = (articles ?? []).filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.subtitle ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount(c => Math.min(c + BATCH, filtered.length));
  }, [filtered.length]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore) loadMore(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Prefer the newest article tagged "featured" (major news) for the hero card
  const featuredIdx = visible.findIndex(
    (a) => Array.isArray(a.tags) && (a.tags as string[]).includes("featured"),
  );
  const featured = featuredIdx >= 0 ? visible[featuredIdx] : visible[0];
  const rest = visible.filter((a) => a !== featured);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Articles & Strategy
              </h1>
              <p className="text-sm text-gray-500">Expert analysis, deck guides, and tournament coverage</p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>
          </div>
          {/* Category Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  category === cat ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={category === cat ? { background: CATEGORY_COLORS[cat] ?? "oklch(0.52 0.22 255)" } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="bg-gray-100 h-32" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-700 mb-1">No articles yet</p>
            <p className="text-sm text-gray-400">
              {search ? "No articles match your search." : "Articles will appear here once published by the editorial team."}
            </p>
          </div>
        )}

        {/* Featured Article */}
        {!isLoading && featured && (
          <Link href={`/articles/${featured.slug}`}>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center min-h-[200px]">
                  <img
                    src={featured.coverImageUrl ?? CATEGORY_IMAGES[featured.category ?? "General"] ?? CATEGORY_IMAGES.General}
                    alt={featured.title}
                    className="h-40 object-contain drop-shadow-xl"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    {featured.category && (
                      <Badge className="text-xs font-bold" style={{ background: CATEGORY_COLORS[featured.category] ?? "#888", color: "white", border: "none" }}>
                        {featured.category}
                      </Badge>
                    )}
                    <span className="text-xs bg-yellow-50 text-yellow-600 font-bold px-2 py-0.5 rounded-full border border-yellow-200">⭐ Featured</span>
                  </div>
                  <h2 className="text-xl font-black text-gray-900 mb-2 leading-tight">{featured.title}</h2>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-3">{featured.subtitle ?? ""}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(featured.publishedAt ?? featured.createdAt)}</span>
                    {featured.tags?.filter((t: string) => t !== "featured").slice(0, 2).map((tag: string) => (
                      <span key={tag} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Article Grid */}
        {!isLoading && rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(article => (
              <Link key={article.id} href={`/articles/${article.slug}`}>
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-blue-200 hover:shadow-md transition-all h-full flex flex-col cursor-pointer">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex items-center justify-center" style={{ minHeight: "120px" }}>
                    <img
                      src={article.coverImageUrl ?? CATEGORY_IMAGES[article.category ?? "General"] ?? CATEGORY_IMAGES.General}
                      alt={article.title}
                      className="h-20 object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {article.category && (
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="text-[10px] font-bold" style={{ background: (CATEGORY_COLORS[article.category] ?? "#888") + "20", color: CATEGORY_COLORS[article.category] ?? "#888", border: "none" }}>
                          {article.category}
                        </Badge>
                      </div>
                    )}
                    <h3 className="font-bold text-gray-800 text-sm leading-tight mb-2 flex-1">{article.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{article.subtitle ?? ""}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
                      <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(article.publishedAt ?? article.createdAt)}</span>
                      {article.tags?.filter((t: string) => t !== "featured").slice(0, 2).map((tag: string) => (
                        <span key={tag} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {hasMore && (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading more articles…</span>
          </div>
        )}
        {!isLoading && !hasMore && filtered.length > BATCH && (
          <p className="text-center py-6 text-sm text-gray-400">{filtered.length} articles loaded</p>
        )}
      </div>
    </div>
  );
}
