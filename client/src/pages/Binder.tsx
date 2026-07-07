import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  Database, ExternalLink, Minus, Plus, Search, ShoppingCart, Star, Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SPECIAL_RARITIES = new Set([
  "Special Illustration Rare", "Hyper Rare", "Secret Rare", "Rainbow Rare",
  "Gold Rare", "Illustration Rare", "Double Rare", "Ultra Rare",
]);

export default function Binder() {
  const { isAuthenticated } = useAuth();
  const [searchQ, setSearchQ] = useState("");

  const { data, isLoading, refetch } = trpc.binder.list.useQuery(undefined, { enabled: isAuthenticated });
  const removeMutation = trpc.binder.remove.useMutation({
    onSuccess: () => { toast.success("Card removed from binder"); refetch(); },
  });
  const updateQtyMutation = trpc.binder.update.useMutation({
    onSuccess: () => refetch(),
  });

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sign In to Access Your Binder</h2>
        <p className="text-muted-foreground mb-6">Track your collection and see your portfolio value in USD.</p>
        <Button className="bg-primary text-primary-foreground" onClick={() => window.location.href = getLoginUrl()}>
          Sign In Free
        </Button>
      </div>
    );
  }

  const cards = Array.isArray(data) ? data : [];
  const filtered = cards.filter((c) =>
    !searchQ || c.cardName.toLowerCase().includes(searchQ.toLowerCase()) || (c.setName?.toLowerCase().includes(searchQ.toLowerCase()) ?? false)
  );

  const totalValue = cards.reduce((s: number, c: typeof cards[0]) => s + (c.priceUsd ? parseFloat(String(c.priceUsd)) * c.quantity : 0), 0);
  const totalCards = cards.reduce((s: number, c: typeof cards[0]) => s + c.quantity, 0);

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-1">My Binder</h1>
          <p className="text-muted-foreground">Track your Pokémon TCG collection</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Cards</p>
          <p className="text-2xl font-bold text-foreground font-display">{totalCards.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Unique Cards</p>
          <p className="text-2xl font-bold text-foreground font-display">{cards.length}</p>
        </div>
        <div className="bg-card border border-[oklch(0.78_0.18_85/0.3)] rounded-xl p-5 col-span-2 sm:col-span-1 bg-gradient-to-br from-[oklch(0.78_0.18_85/0.05)] to-transparent">
          <p className="text-xs text-muted-foreground mb-1">Portfolio Value</p>
          <p className="text-2xl font-bold text-primary font-display">${totalValue.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Based on TCGPlayer market prices</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search your binder…"
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
        />
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-[3/4.2] bg-muted" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">
            {searchQ ? "No cards match your search" : "Your binder is empty"}
          </p>
          <p className="text-muted-foreground text-sm">
            {searchQ ? "Try a different search term" : "Browse the card database and add cards to your collection"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((item: typeof cards[0]) => {
            const isSpecial = SPECIAL_RARITIES.has(item.rarity ?? "");
            const tcgUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(item.cardName)}&utm_source=pokehub`;
            return (
              <div
                key={item.id}
                className={cn(
                  "group relative bg-card rounded-xl overflow-hidden border transition-all duration-200 hover:-translate-y-1",
                  isSpecial
                    ? "border-[oklch(0.78_0.18_85/0.4)] hover:border-[oklch(0.78_0.18_85/0.7)] hover:shadow-[0_8px_24px_oklch(0.78_0.18_85/0.2)]"
                    : "border-border hover:border-border/80 hover:shadow-[0_8px_24px_oklch(0_0_0/0.3)]"
                )}
              >
                {/* Special rare glow */}
                {isSpecial && (
                  <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.78_0.18_85/0.05)] to-transparent pointer-events-none z-10" />
                )}

                {/* Quantity badge */}
                <div className="absolute top-2 right-2 z-20 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  ×{item.quantity}
                </div>

                {/* Special rare badge */}
                {isSpecial && (
                  <div className="absolute top-2 left-2 z-20">
                    <Star className="w-3.5 h-3.5 text-[oklch(0.78_0.18_85)] fill-current drop-shadow-sm" />
                  </div>
                )}

                {/* Card image */}
                <div className="aspect-[3/4.2] bg-muted overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.cardName}
                      className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Database className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-foreground truncate">{item.cardName}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.setName}</p>
                  {item.priceUsd && (
                    <p className={cn("text-xs font-bold mt-1.5", isSpecial ? "text-[oklch(0.78_0.18_85)]" : "text-primary")}>
                      ${(parseFloat(String(item.priceUsd)) * item.quantity).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Hover actions */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200 z-30">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQtyMutation.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) as number })}
                        className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white text-xs font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQtyMutation.mutate({ id: item.id, quantity: item.quantity + 1 as number })}
                        className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={tcgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-6 h-6 rounded bg-[oklch(0.55_0.18_240/0.8)] hover:bg-[oklch(0.55_0.18_240)] flex items-center justify-center text-white transition-colors"
                      >
                        <ShoppingCart className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => removeMutation.mutate({ id: item.id })}
                        className="w-6 h-6 rounded bg-destructive/80 hover:bg-destructive flex items-center justify-center text-white transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
