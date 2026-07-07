import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeftRight, Heart, Loader2, MapPin, Plus, Search, Sparkles, Star, Trash2, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CONDITIONS, ConditionPill } from "@/components/ConditionPill";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PickedCard {
  id: string;
  name: string;
  setId?: string;
  setName?: string;
  imageUrl?: string;
}

interface BazaarItem {
  id: number;
  cardId: string;
  cardName: string;
  setName: string | null;
  imageUrl: string | null;
  quantity: number;
  condition: string;
  priceUsd: string | null;
  isForTrade: boolean;
  isForSale: boolean;
  notes: string | null;
  createdAt: string | Date;
}

interface BazaarRow {
  bazaarItem: BazaarItem;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerLocation: string | null;
  ownerRating: string | null;
}

// ─── Card picker (shared by both dialogs) ────────────────────────────────────

function CardPicker({ onPick }: { onPick: (c: PickedCard) => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = trpc.cards.search.useQuery(
    { q: q.trim(), page: 1, pageSize: 12 },
    { enabled: q.trim().length >= 2 },
  );
  const cards = (data as { data?: Array<{ id: string; name: string; set: { id: string; name: string }; images: { small: string; large: string } }> } | undefined)?.data ?? [];

  return (
    <div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search card by name..." className="pl-9" />
        {isFetching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {cards.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3 max-h-56 overflow-y-auto">
          {cards.map(c => (
            <button key={c.id} type="button"
              className="rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow transition-all"
              onClick={() => onPick({ id: c.id, name: c.name, setId: c.set.id, setName: c.set.name, imageUrl: c.images.small })}>
              <img src={c.images.small} alt={c.name} loading="lazy" className="w-full" />
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && !isFetching && cards.length === 0 && (
        <p className="text-sm text-gray-400 mt-3 text-center">No cards found</p>
      )}
    </div>
  );
}

function PickedCardHeader({ card, onClear }: { card: PickedCard; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
      {card.imageUrl && <img src={card.imageUrl} alt="" className="w-10 rounded" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm line-clamp-1">{card.name}</p>
        {card.setName && <p className="text-xs text-gray-500">{card.setName}</p>}
      </div>
      <button type="button" onClick={onClear}><X className="w-4 h-4 text-gray-400" /></button>
    </div>
  );
}

// ─── Post-item dialog ─────────────────────────────────────────────────────────

function PostItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [card, setCard] = useState<PickedCard | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("NM");
  const [forTrade, setForTrade] = useState(true);
  const [forSale, setForSale] = useState(false);
  const [price, setPrice] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.bazaar.create.useMutation({
    onSuccess: () => {
      toast.success("Posted to the Bazaar!");
      utils.bazaar.invalidate();
      setCard(null); setQuantity("1"); setPrice(""); setForTrade(true); setForSale(false);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Post a card to the Bazaar</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {card ? <PickedCardHeader card={card} onClear={() => setCard(null)} /> : <CardPicker onPick={setCard} />}

          {card && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Quantity</label>
                  <Input type="number" min="1" max="99" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Condition</label>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {CONDITIONS.map(c => (
                      <button key={c} type="button" onClick={() => setCondition(c)}
                        className={condition === c ? "ring-2 ring-blue-500 rounded-full" : ""}>
                        <ConditionPill condition={c} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" checked={forTrade} onChange={e => setForTrade(e.target.checked)} />
                  For trade
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" checked={forSale} onChange={e => setForSale(e.target.checked)} />
                  For sale
                </label>
                {forSale && (
                  <Input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                    placeholder="Price USD" className="w-28 h-8" />
                )}
              </div>

              <Button className="w-full"
                disabled={create.isPending || (!forTrade && !forSale) || (forSale && (!price || Number(price) <= 0))}
                onClick={() => create.mutate({
                  cardId: card.id,
                  cardName: card.name,
                  setId: card.setId,
                  setName: card.setName,
                  imageUrl: card.imageUrl,
                  quantity: Math.max(1, Number(quantity) || 1),
                  condition,
                  isForTrade: forTrade,
                  isForSale: forSale,
                  priceUsd: forSale && price ? Number(price) : undefined,
                })}>
                {create.isPending ? "Posting…" : "Post to Bazaar"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add-want dialog ──────────────────────────────────────────────────────────

function AddWantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [card, setCard] = useState<PickedCard | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("NM");
  const [maxPrice, setMaxPrice] = useState("");
  const utils = trpc.useUtils();

  const add = trpc.bazaar.addWant.useMutation({
    onSuccess: () => {
      toast.success("Added to your want list!");
      utils.bazaar.invalidate();
      setCard(null); setQuantity("1"); setMaxPrice("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add card to want list</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {card ? <PickedCardHeader card={card} onClear={() => setCard(null)} /> : <CardPicker onPick={setCard} />}
          {card && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Quantity</label>
                  <Input type="number" min="1" max="99" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Max price (optional)</label>
                  <Input type="number" min="0.01" step="0.01" value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)} placeholder="USD" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Minimum condition</label>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {CONDITIONS.map(c => (
                    <button key={c} type="button" onClick={() => setCondition(c)}
                      className={condition === c ? "ring-2 ring-blue-500 rounded-full" : ""}>
                      <ConditionPill condition={c} />
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" disabled={add.isPending}
                onClick={() => add.mutate({
                  cardId: card.id,
                  cardName: card.name,
                  setId: card.setId,
                  imageUrl: card.imageUrl,
                  quantity: Math.max(1, Number(quantity) || 1),
                  condition,
                  maxPriceUsd: maxPrice ? Number(maxPrice) : undefined,
                })}>
                {add.isPending ? "Adding…" : "Add to want list"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bazaar item card ─────────────────────────────────────────────────────────

function BazaarCard({ row }: { row: BazaarRow }) {
  const b = row.bazaarItem;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-md transition-all">
      <div className="flex gap-3">
        <Link href={`/cards/${b.cardId}`} className="w-16 shrink-0">
          {b.imageUrl
            ? <img src={b.imageUrl} alt={b.cardName} loading="lazy" className="w-full rounded-lg" />
            : <div className="w-16 h-22 bg-gray-100 rounded-lg" />}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/cards/${b.cardId}`} className="font-bold text-sm line-clamp-1 hover:underline"
            style={{ color: "oklch(0.18 0.02 240)" }}>{b.cardName}</Link>
          {b.setName && <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>{b.setName}</p>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <ConditionPill condition={b.condition} />
            <span className="text-xs font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>×{b.quantity}</span>
            {b.isForTrade && <span className="badge badge-blue text-[10px]">TRADE</span>}
            {b.isForSale && b.priceUsd && <span className="badge badge-green text-[10px]">${Number(b.priceUsd).toFixed(2)}</span>}
          </div>
          {b.notes && <p className="text-xs mt-1 line-clamp-1" style={{ color: "oklch(0.52 0.015 240)" }}>{b.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>
        <Link href={row.ownerUsername ? `/profile/${row.ownerUsername}` : "#"}
          className="font-bold hover:underline" style={{ color: "oklch(0.18 0.02 240)" }}>
          {row.ownerName ?? "User"}
        </Link>
        {row.ownerRating != null && (
          <span className="inline-flex items-center gap-0.5">
            <Star className="w-3 h-3" fill="#F59E0B" stroke="#F59E0B" />{Number(row.ownerRating).toFixed(1)}
          </span>
        )}
        {row.ownerLocation && (
          <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{row.ownerLocation}</span>
        )}
      </div>
    </div>
  );
}

// ─── Top strips ───────────────────────────────────────────────────────────────

function TopStrip({ title, items, metric }: {
  title: string;
  items: Array<{ cardId: string; cardName: string; imageUrl: string | null; count: number }>;
  metric: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="font-black text-sm mb-2 flex items-center gap-1.5" style={{ color: "oklch(0.18 0.02 240)" }}>
        <Sparkles className="w-4 h-4" style={{ color: "oklch(0.52 0.22 255)" }} />{title}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map(c => (
          <Link key={c.cardId} href={`/cards/${c.cardId}`} className="shrink-0 w-24 group">
            {c.imageUrl
              ? <img src={c.imageUrl} alt={c.cardName} loading="lazy"
                  className="w-24 rounded-lg group-hover:shadow-lg transition-all" />
              : <div className="w-24 h-32 bg-gray-100 rounded-lg" />}
            <p className="text-[11px] font-bold mt-1 line-clamp-1" style={{ color: "oklch(0.35 0.02 240)" }}>{c.cardName}</p>
            <p className="text-[10px]" style={{ color: "oklch(0.52 0.015 240)" }}>{c.count} {metric}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "browse" | "matches" | "mine" | "wants";

export default function Bazaar() {
  usePageMeta("Bazaar", "Trade and sell Pokémon cards with other collectors. Post your cards, build a want list, find matches.");
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "trade" | "sale">("all");
  const [page, setPage] = useState(1);
  const [showPost, setShowPost] = useState(false);
  const [showWant, setShowWant] = useState(false);
  const utils = trpc.useUtils();

  const browse = trpc.bazaar.list.useQuery({
    q: search.trim() || undefined,
    forTrade: filter === "trade" ? true : undefined,
    forSale: filter === "sale" ? true : undefined,
    page,
    pageSize: 24,
  });
  const topWanted = trpc.bazaar.topWanted.useQuery();
  const topForTrade = trpc.bazaar.topForTrade.useQuery();
  const matches = trpc.bazaar.matches.useQuery(undefined, { enabled: isAuthenticated && tab === "matches" });
  const mine = trpc.bazaar.mine.useQuery(undefined, { enabled: isAuthenticated && tab === "mine" });
  const wants = trpc.bazaar.wantList.useQuery(undefined, { enabled: isAuthenticated && tab === "wants" });

  const removeItem = trpc.bazaar.remove.useMutation({
    onSuccess: () => { toast.success("Removed"); utils.bazaar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const removeWant = trpc.bazaar.removeWant.useMutation({
    onSuccess: () => { toast.success("Removed"); utils.bazaar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const items = (browse.data?.items ?? []) as BazaarRow[];
  const total = browse.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 24));

  const TABS: Array<{ id: Tab; label: string; auth?: boolean }> = [
    { id: "browse", label: "Browse" },
    { id: "matches", label: "Matches", auth: true },
    { id: "mine", label: "My Items", auth: true },
    { id: "wants", label: "Want List", auth: true },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a2744 50%, #2d4a8a 100%)" }} className="py-10">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <ArrowLeftRight size={12} />Card Trading
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Bazaar — Trade & Sell Cards
          </h1>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Post cards you have, list cards you want, and get automatic matches with collectors across the USA.
          </p>
        </div>
      </div>

      <div className="container py-6">
        {/* Tabs + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="tab-list mb-0">
            {TABS.map(t => (
              (!t.auth || isAuthenticated) && (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn("tab-item", tab === t.id && "active")}>
                  {t.label}
                  {t.id === "matches" && matches.data && (matches.data.theyHave.length + matches.data.theyWant.length) > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black text-white rounded-full"
                      style={{ background: "#DC2626" }}>
                      {matches.data.theyHave.length + matches.data.theyWant.length}
                    </span>
                  )}
                </button>
              )
            ))}
          </div>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowWant(true)}>
                  <Heart className="w-4 h-4" />Add want
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setShowPost(true)}>
                  <Plus className="w-4 h-4" />Post card
                </Button>
              </>
            ) : (
              <a href={getLoginUrl()} className="btn-primary text-sm">Sign in to trade</a>
            )}
          </div>
        </div>

        {/* ── Browse tab ── */}
        {tab === "browse" && (
          <>
            <TopStrip title="Most wanted cards"
              items={(topWanted.data ?? []).map(c => ({ ...c, count: Number(c.wantCount) }))} metric="want this" />
            <TopStrip title="Most offered for trade"
              items={(topForTrade.data ?? []).map(c => ({ ...c, count: Number(c.tradeCount) }))} metric="for trade" />

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by card name..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:border-transparent" />
              </div>
              <div className="flex gap-2">
                {([["all", "All"], ["trade", "For Trade"], ["sale", "For Sale"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => { setFilter(v); setPage(1); }}
                    className={cn("px-3 py-2 rounded-xl text-sm font-bold border transition-all",
                      filter === v ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600")}
                    style={filter === v ? { background: "oklch(0.52 0.22 255)" } : undefined}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {browse.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl">🤝</span>
                <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>No bazaar posts yet</p>
                <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 240)" }}>Be the first to post a card for trade or sale.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map(row => <BazaarCard key={row.bazaarItem.id} row={row} />)}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn disabled:opacity-40">‹</button>
                    <span className="text-sm font-bold">{page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="page-btn disabled:opacity-40">›</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Matches tab ── */}
        {tab === "matches" && (
          matches.isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-8">
              <div>
                <h2 className="font-black text-lg mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>
                  🎯 They have what you want ({matches.data?.theyHave.length ?? 0})
                </h2>
                {(matches.data?.theyHave.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: "oklch(0.52 0.015 240)" }}>
                    No matches yet — add cards to your want list and we'll find them in the bazaar.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(matches.data?.theyHave as BazaarRow[] ?? []).map(row => <BazaarCard key={row.bazaarItem.id} row={row} />)}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-black text-lg mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>
                  🔥 They want what you have ({matches.data?.theyWant.length ?? 0})
                </h2>
                {(matches.data?.theyWant.length ?? 0) === 0 ? (
                  <p className="text-sm" style={{ color: "oklch(0.52 0.015 240)" }}>
                    No matches yet — post your cards to the bazaar to appear in other collectors' matches.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(matches.data?.theyWant ?? []).map((row) => (
                      <div key={row.wantItem.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex gap-3">
                          <Link href={`/cards/${row.wantItem.cardId}`} className="w-16 shrink-0">
                            {row.wantItem.imageUrl
                              ? <img src={row.wantItem.imageUrl} alt="" loading="lazy" className="w-full rounded-lg" />
                              : <div className="w-16 h-22 bg-gray-100 rounded-lg" />}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm line-clamp-1">{row.wantItem.cardName}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <ConditionPill condition={row.wantItem.condition} />
                              <span className="text-xs font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>×{row.wantItem.quantity}</span>
                              {row.wantItem.maxPriceUsd && (
                                <span className="badge badge-green text-[10px]">up to ${Number(row.wantItem.maxPriceUsd).toFixed(2)}</span>
                              )}
                            </div>
                            <p className="text-xs mt-2" style={{ color: "oklch(0.52 0.015 240)" }}>
                              Wanted by{" "}
                              <Link href={row.ownerUsername ? `/profile/${row.ownerUsername}` : "#"}
                                className="font-bold hover:underline" style={{ color: "oklch(0.18 0.02 240)" }}>
                                {row.ownerName ?? "User"}
                              </Link>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ── My Items tab ── */}
        {tab === "mine" && (
          mine.isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : (mine.data?.length ?? 0) === 0 ? (
            <div className="text-center py-16">
              <span className="text-6xl">📦</span>
              <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>You haven't posted any cards</p>
              <Button className="mt-4 gap-1.5" onClick={() => setShowPost(true)}><Plus className="w-4 h-4" />Post your first card</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {((mine.data ?? []) as BazaarItem[]).map(b => (
                <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    <Link href={`/cards/${b.cardId}`} className="w-16 shrink-0">
                      {b.imageUrl ? <img src={b.imageUrl} alt="" loading="lazy" className="w-full rounded-lg" />
                        : <div className="w-16 h-22 bg-gray-100 rounded-lg" />}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm line-clamp-1">{b.cardName}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <ConditionPill condition={b.condition} />
                        <span className="text-xs font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>×{b.quantity}</span>
                        {b.isForTrade && <span className="badge badge-blue text-[10px]">TRADE</span>}
                        {b.isForSale && b.priceUsd && <span className="badge badge-green text-[10px]">${Number(b.priceUsd).toFixed(2)}</span>}
                      </div>
                    </div>
                    <button className="self-start" disabled={removeItem.isPending}
                      onClick={() => removeItem.mutate({ id: b.id })} aria-label="Remove">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Want List tab ── */}
        {tab === "wants" && (
          wants.isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : (wants.data?.length ?? 0) === 0 ? (
            <div className="text-center py-16">
              <span className="text-6xl">💝</span>
              <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>Your want list is empty</p>
              <Button className="mt-4 gap-1.5" onClick={() => setShowWant(true)}><Heart className="w-4 h-4" />Add a card</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(wants.data ?? []).map((w) => (
                <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    <Link href={`/cards/${w.cardId}`} className="w-16 shrink-0">
                      {w.imageUrl ? <img src={w.imageUrl} alt="" loading="lazy" className="w-full rounded-lg" />
                        : <div className="w-16 h-22 bg-gray-100 rounded-lg" />}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm line-clamp-1">{w.cardName}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <ConditionPill condition={w.condition} />
                        <span className="text-xs font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>×{w.quantity}</span>
                        {w.maxPriceUsd && <span className="badge badge-green text-[10px]">up to ${Number(w.maxPriceUsd).toFixed(2)}</span>}
                      </div>
                    </div>
                    <button className="self-start" disabled={removeWant.isPending}
                      onClick={() => removeWant.mutate({ id: w.id })} aria-label="Remove">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <PostItemDialog open={showPost} onClose={() => setShowPost(false)} />
      <AddWantDialog open={showWant} onClose={() => setShowWant(false)} />
    </div>
  );
}
