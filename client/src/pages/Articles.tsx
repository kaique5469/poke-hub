import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Clock, Search } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  ["all", "All coverage"],
  ["news", "News"],
  ["strategy", "Strategy"],
  ["deck_guide", "Deck guides"],
  ["set_review", "Set reviews"],
  ["tournament", "Tournaments"],
  ["collector", "Collector market"],
] as const;
const LABELS = Object.fromEntries(CATEGORIES);
const FALLBACKS: Record<string, string> = {
  news: "https://images.pokemontcg.io/swsh7/218_hires.png",
  strategy: "https://images.pokemontcg.io/sv3/215_hires.png",
  deck_guide: "https://images.pokemontcg.io/swsh11/186_hires.png",
  set_review: "https://images.pokemontcg.io/sv8pt5/logo.png",
  tournament: "https://images.pokemontcg.io/swsh11/186_hires.png",
  collector: "https://images.pokemontcg.io/base1/4_hires.png",
};

type Article = {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  category: string;
  tags: unknown;
  publishedAt: string | null;
  createdAt: string;
};
const label = (category: string) =>
  LABELS[category] ?? category.replaceAll("_", " ");
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently published";

function EditorialImage({
  article,
  featured = false,
}: {
  article: Article;
  featured?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    article.coverImageUrl ?? FALLBACKS[article.category] ?? FALLBACKS.news;
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#111827] to-[#312e81]",
        featured ? "min-h-72 lg:min-h-[420px]" : "h-48"
      )}
    >
      {!failed ? (
        <img
          src={src}
          alt={article.title}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full",
            article.coverImageUrl &&
              !article.coverImageUrl.includes("official-artwork")
              ? "object-cover"
              : "object-contain p-6 drop-shadow-2xl"
          )}
        />
      ) : (
        <BookOpen className="h-12 w-12 text-white/30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}

export default function Articles() {
  usePageMeta(
    "Pokémon TCG Articles",
    "Latest Pokémon TCG news, strategy, deck guides, set reviews and collector market coverage."
  );
  const initial = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(initial.get("q") ?? "");
  const [category, setCategory] = useState(initial.get("category") ?? "all");
  const articles = trpc.articles.list.useQuery(
    { category: category === "all" ? undefined : category, limit: 100 },
    { staleTime: 300_000 }
  );
  const filtered = ((articles.data ?? []) as Article[]).filter(article => {
    const needle = query.trim().toLowerCase();
    return (
      !needle ||
      article.title.toLowerCase().includes(needle) ||
      article.subtitle?.toLowerCase().includes(needle) ||
      (Array.isArray(article.tags) &&
        article.tags.some(tag => String(tag).toLowerCase().includes(needle)))
    );
  });
  const featuredIndex = filtered.findIndex(
    article => Array.isArray(article.tags) && article.tags.includes("featured")
  );
  const lead = featuredIndex >= 0 ? filtered[featuredIndex] : filtered[0];
  const rest = filtered.filter(article => article !== lead);

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="border-b border-white/10 bg-[#0b1020] text-white">
        <div className="container grid gap-8 py-12 md:grid-cols-[1fr_360px] md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300">
              TCG Arena editorial
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              Know the cards. Understand the market.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Fresh Pokémon TCG reporting, practical deck strategy and collector
              analysis—published newest first and grounded in cited sources.
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search the editorial archive"
              className="w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20"
            />
          </label>
        </div>
      </section>

      <div className="container py-8">
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map(([id, title]) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-xs font-black",
                category === id
                  ? "bg-gray-950 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-violet-300"
              )}
            >
              {title}
            </button>
          ))}
        </div>
        {articles.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : !lead ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
            <h2 className="mt-4 text-xl font-black text-gray-900">
              No articles matched
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Try another keyword or choose a different category.
            </p>
          </div>
        ) : (
          <>
            <section className="mb-12 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <Link
                href={`/articles/${lead.slug}`}
                className="grid lg:grid-cols-[1.15fr_.85fr]"
              >
                <EditorialImage article={lead} featured />
                <div className="flex flex-col justify-center p-7 lg:p-10">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                      {label(lead.category)}
                    </span>
                    <span className="text-xs font-bold text-gray-400">
                      Lead story
                    </span>
                  </div>
                  <h2 className="mt-5 text-3xl font-black leading-tight text-gray-950">
                    {lead.title}
                  </h2>
                  {lead.subtitle && (
                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-gray-600">
                      {lead.subtitle}
                    </p>
                  )}
                  <div className="mt-6 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      {date(lead.publishedAt ?? lead.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-black text-violet-700">
                      Read story <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </section>
            {rest.length > 0 && (
              <section>
                <div className="mb-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                    Latest coverage
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-gray-950">
                    More from the editorial desk
                  </h2>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map(article => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl"
                    >
                      <EditorialImage article={article} />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                            {label(article.category)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                            <Clock className="h-3 w-3" />
                            {date(article.publishedAt ?? article.createdAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 line-clamp-3 text-lg font-black leading-6 text-gray-950 group-hover:text-violet-700">
                          {article.title}
                        </h3>
                        {article.subtitle && (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-500">
                            {article.subtitle}
                          </p>
                        )}
                        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-black text-violet-700">
                          Read article <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
