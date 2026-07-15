import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowLeft, ArrowRight, CalendarDays, CreditCard, Flame, Layers, Package } from "lucide-react";
import { Link, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

function cardPrice(card: any): number | null {
  const prices = card?.tcgplayer?.prices;
  if (!prices) return null;
  const preferred = prices.holofoil ?? prices["1stEditionHolofoil"] ?? prices.normal ?? prices.reverseHolofoil;
  return preferred?.market ?? preferred?.mid ?? preferred?.low ?? null;
}

function productTypeLabel(category: string): string {
  const labels: Record<string, string> = {
    booster_pack: "Booster Pack",
    booster_box: "Booster Box",
    etb: "Elite Trainer Box",
    tin: "Tin",
    blister: "Blister",
    pre_release: "Build & Battle",
    battle_deck: "Battle Deck",
    theme_deck: "Theme Deck",
    collector_box: "Collection",
  };
  return labels[category] ?? "Sealed Product";
}

function LoadingPage() {
  return (
    <div className="container py-8 space-y-8">
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
      </div>
    </div>
  );
}

export default function SetDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, error } = trpc.sets.detail.useQuery({ id }, { enabled: Boolean(id), retry: false });
  usePageMeta(data?.set?.name ?? "Pokémon TCG Set", "Cards, sealed products and market highlights for this Pokémon TCG expansion.");

  if (isLoading) return <LoadingPage />;
  if (error || !data) {
    return (
      <div className="container py-24 text-center">
        <Layers className="w-14 h-14 mx-auto text-muted-foreground/40" />
        <h1 className="text-2xl font-black mt-4">Set not found</h1>
        <Link href="/sets" className="inline-flex items-center gap-2 mt-5 text-primary font-bold"><ArrowLeft size={16} /> All sets</Link>
      </div>
    );
  }

  const { set, products, cards, hotCards, totalCards } = data;
  const releaseDate = set.releaseDate
    ? new Date(`${set.releaseDate.replaceAll("/", "-")}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <div className="container py-6 md:py-10 space-y-12">
        <Link href="/sets" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
          <ArrowLeft size={16} /> All Pokémon TCG sets
        </Link>

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#090d18] via-[#20164a] to-[#6d28d9] text-white shadow-2xl">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
          <div className="absolute -left-20 -bottom-28 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative grid md:grid-cols-[1fr_360px] gap-8 items-center p-7 md:p-12 min-h-64">
            <div>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold">{set.series}</span>
                <span className="rounded-full bg-emerald-400/15 border border-emerald-300/20 px-3 py-1 text-xs font-bold text-emerald-200">English · USD market</span>
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-black tracking-tight">{set.name}</h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm text-white/75">
                {releaseDate && <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> {releaseDate}</span>}
                <span className="inline-flex items-center gap-2"><CreditCard size={16} /> {set.total} cards</span>
                <span className="inline-flex items-center gap-2"><Package size={16} /> {products.length} sealed products</span>
              </div>
            </div>
            <div className="h-36 md:h-44 flex items-center justify-center rounded-2xl bg-white/95 p-6 shadow-xl">
              <img src={set.images.logo} alt={`${set.name} logo`} className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Real catalog</p>
              <h2 className="font-display text-2xl md:text-3xl font-black text-slate-900 mt-1">Sealed products</h2>
              <p className="text-sm text-slate-500 mt-1">Official product photography and current USD reference prices.</p>
            </div>
            <Link href={`/shop?set=${set.id}`} className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:text-violet-900">
              Shop this set <ArrowRight size={15} />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product: any) => {
                const price = product.avgPriceUsd ?? product.minPriceUsd;
                return (
                  <Link key={product.id} href={`/shop/${product.slug}`} className="group rounded-2xl bg-white border border-slate-200 overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:border-violet-300 transition-all">
                    <div className="relative aspect-square bg-gradient-to-b from-white to-slate-50 p-5 flex items-center justify-center">
                      <span className="absolute left-3 top-3 rounded-full bg-slate-900/85 text-white text-[10px] font-black px-2.5 py-1">{productTypeLabel(product.category)}</span>
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform" /> : <Package className="w-14 h-14 text-slate-300" />}
                    </div>
                    <div className="p-4 border-t border-slate-100">
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-2 min-h-10">{product.name}</h3>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Market reference</span>
                        <span className="font-black text-emerald-600">{price ? `$${Number(price).toFixed(2)}` : "—"}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Product catalog for this expansion is being updated.
            </div>
          )}
        </section>

        {hotCards.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-orange-100 text-orange-600"><Flame size={18} /></span>
              <div>
                <h2 className="font-display text-2xl font-black text-slate-900">Hot cards</h2>
                <p className="text-sm text-slate-500">Chase cards and standout rarities from {set.name}.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {hotCards.slice(0, 12).map((card: any) => {
                const price = cardPrice(card);
                return (
                  <Link key={card.id} href={`/cards/${card.id}`} className="group">
                    <div className="relative rounded-xl overflow-hidden shadow-md group-hover:-translate-y-1 group-hover:shadow-xl transition-all bg-slate-900">
                      <img src={card.images?.large ?? card.images?.small} alt={card.name} loading="lazy" className="w-full aspect-[2.5/3.5] object-contain" />
                      {price !== null && <span className="absolute bottom-2 right-2 rounded-lg bg-black/80 px-2 py-1 text-xs font-black text-emerald-300">${price.toFixed(2)}</span>}
                    </div>
                    <p className="font-bold text-xs text-slate-800 mt-2 truncate">{card.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{card.rarity}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-2xl font-black text-slate-900">Card checklist</h2>
              <p className="text-sm text-slate-500">Showing {cards.length} of {totalCards} cards.</p>
            </div>
            <Link href={`/cards?set=${set.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-violet-700">View all cards <ArrowRight size={15} /></Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {cards.map((card: any) => (
              <Link key={card.id} href={`/cards/${card.id}`} className="group min-w-0">
                <img src={card.images?.small} alt={card.name} loading="lazy" className="w-full rounded-lg shadow-sm group-hover:-translate-y-1 group-hover:shadow-lg transition-all" />
                <p className="mt-1.5 text-[11px] font-bold text-slate-700 truncate">{card.name}</p>
                <p className="text-[10px] text-slate-400">#{card.number}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

