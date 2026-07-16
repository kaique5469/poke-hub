import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BookOpen,
  Layers3,
  Loader2,
  Package,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getMarketSessionId } from "@/lib/marketSession";

type GlobalSearchProps = {
  autoFocus?: boolean;
  className?: string;
  onNavigate?: () => void;
};

function ResultImage({
  src,
  alt,
  fallback,
}: {
  src?: string | null;
  alt: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export default function GlobalSearch({
  autoFocus,
  className,
  onNavigate,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const recordMarketEvent = trpc.market.recordEvent.useMutation();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const search = trpc.discovery.search.useQuery(
    { q: debounced.length >= 2 ? debounced : "__" },
    { enabled: debounced.length >= 2, retry: false, staleTime: 60_000 }
  );
  const data = search.data;
  const total =
    (data?.cards.length ?? 0) +
    (data?.sets.length ?? 0) +
    (data?.products.length ?? 0) +
    (data?.articles.length ?? 0);
  const navigate = () => {
    setOpen(false);
    onNavigate?.();
  };
  const navigateToCard = (card: {
    id: string;
    name: string;
    setName?: string | null;
    image?: string | null;
  }) => {
    recordMarketEvent.mutate({
      sessionId: getMarketSessionId(),
      eventType: "search",
      query: query.trim(),
      card: {
        cardId: card.id,
        cardName: card.name,
        setName: card.setName ?? null,
        imageUrl: card.image ?? null,
      },
      metadata: { surface: "global_search" },
    });
    navigate();
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search cards, sets, sealed products and articles"
        aria-label="Search the marketplace"
        className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-10 text-sm text-gray-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl md:left-1/2 md:right-auto md:w-[min(720px,80vw)] md:-translate-x-1/2">
          {search.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching the arena…
            </div>
          ) : total === 0 ? (
            <div className="px-4 py-10 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-gray-300" />
              <p className="font-bold text-gray-800">No exact match yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Try a Pokémon name, set code or product type.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {data?.cards.length ? (
                <ResultGroup
                  title="Cards"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  {data.cards.map(card => (
                    <Link
                      key={card.id}
                      href={`/cards/${card.id}`}
                      onClick={() => navigateToCard(card)}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-violet-50"
                    >
                      <span className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
                        <ResultImage
                          src={card.image}
                          alt={card.name}
                          fallback={
                            <Sparkles className="h-5 w-5 text-gray-300" />
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">
                          {card.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {card.setName} · #{card.number}
                        </span>
                        {card.price != null && (
                          <span className="text-xs font-black text-emerald-700">
                            ${Number(card.price).toFixed(2)}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </ResultGroup>
              ) : null}

              {data?.sets.length ? (
                <ResultGroup
                  title="Sets"
                  icon={<Layers3 className="h-4 w-4" />}
                >
                  {data.sets.map(set => (
                    <Link
                      key={set.id}
                      href={`/sets/${set.id}`}
                      onClick={navigate}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-violet-50"
                    >
                      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50 p-1">
                        <ResultImage
                          src={set.logo}
                          alt={set.name}
                          fallback={
                            <Layers3 className="h-5 w-5 text-gray-300" />
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">
                          {set.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {set.series} · {set.releaseDate}
                        </span>
                      </span>
                    </Link>
                  ))}
                </ResultGroup>
              ) : null}

              {data?.products.length ? (
                <ResultGroup
                  title="Sealed products"
                  icon={<Package className="h-4 w-4" />}
                >
                  {data.products.map(product => (
                    <Link
                      key={product.id}
                      href={`/shop/${product.slug}`}
                      onClick={navigate}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-violet-50"
                    >
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50 p-1">
                        <ResultImage
                          src={product.image}
                          alt={product.name}
                          fallback={
                            <Package className="h-5 w-5 text-gray-300" />
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block line-clamp-2 text-sm font-bold text-gray-900">
                          {product.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {product.setName ?? "Official product"}
                        </span>
                        {product.price != null && (
                          <span className="text-xs font-black text-emerald-700">
                            ${Number(product.price).toFixed(2)}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </ResultGroup>
              ) : null}

              {data?.articles.length ? (
                <ResultGroup
                  title="Articles"
                  icon={<BookOpen className="h-4 w-4" />}
                >
                  {data.articles.map(article => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      onClick={navigate}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-violet-50"
                    >
                      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
                        <ResultImage
                          src={article.image}
                          alt={article.title}
                          fallback={
                            <BookOpen className="h-5 w-5 text-gray-300" />
                          }
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block line-clamp-2 text-sm font-bold text-gray-900">
                          {article.title}
                        </span>
                        <span className="block text-xs capitalize text-gray-500">
                          {article.category.replace("_", " ")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </ResultGroup>
              ) : null}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-100 p-2 text-xs font-bold text-violet-700">
            <Link
              href={`/cards?q=${encodeURIComponent(query.trim())}`}
              onClick={navigate}
              className="rounded-full bg-violet-50 px-3 py-1.5 hover:bg-violet-100"
            >
              All card results
            </Link>
            <Link
              href={`/shop?q=${encodeURIComponent(query.trim())}`}
              onClick={navigate}
              className="rounded-full bg-violet-50 px-3 py-1.5 hover:bg-violet-100"
            >
              Search sealed products
            </Link>
            <Link
              href={`/articles?q=${encodeURIComponent(query.trim())}`}
              onClick={navigate}
              className="rounded-full bg-violet-50 px-3 py-1.5 hover:bg-violet-100"
            >
              Search articles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 p-1">
      <h3 className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
