import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { BookOpen, Globe, Lock, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Decks() {
  usePageMeta("Decks", "Browse and share competitive Pokémon TCG decklists.");
  const { isAuthenticated } = useAuth();
  const { data: myDecks, isLoading, refetch } = trpc.decks.myDecks.useQuery(undefined, { enabled: isAuthenticated });
  const { data: publicDecks, isLoading: publicLoading } = trpc.decks.publicDecks.useQuery();
  const deleteMutation = trpc.decks.delete.useMutation({ onSuccess: () => { toast.success("Deck deleted"); refetch(); } });

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sign In to Build Decks</h2>
        <p className="text-muted-foreground mb-6">Save and manage your competitive decks with a free account.</p>
        <Button className="bg-primary text-primary-foreground" onClick={() => window.location.href = getLoginUrl()}>
          Sign In Free
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-1">My Decks</h1>
          <p className="text-muted-foreground">Build and manage your competitive decks</p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
          <Link href="/decks/builder"><Plus className="w-4 h-4" /> New Deck</Link>
        </Button>
      </div>

      {/* My Decks */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3.5 bg-muted rounded w-1/3 mb-4" />
              <div className="h-2 bg-muted rounded-full mb-3" />
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded w-16" />
                <div className="h-6 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : myDecks && myDecks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {myDecks.map((deck) => (
            <div key={deck.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{deck.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{deck.format} · {deck.cardCount}/60 cards</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {deck.isPublic ? (
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {deck.estimatedCostUsd && (
                <p className="text-sm font-bold text-primary mb-3">${parseFloat(String(deck.estimatedCostUsd)).toFixed(2)} est.</p>
              )}

              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                <div
                  className={cn("h-full rounded-full", deck.cardCount === 60 ? "bg-[oklch(0.70_0.18_145)]" : "bg-primary")}
                  style={{ width: `${Math.min((deck.cardCount / 60) * 100, 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" asChild className="flex-1 text-xs">
                  <Link href={`/decks/builder?id=${deck.id}`}>Edit</Link>
                </Button>
                {deck.isPublic && (
                  <Button size="sm" variant="outline" asChild className="flex-1 text-xs">
                    <Link href={`/decks/${deck.id}`}>View</Link>
                  </Button>
                )}
                <button
                  onClick={() => deleteMutation.mutate({ id: deck.id })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center mb-10">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">No decks yet</p>
          <p className="text-muted-foreground text-sm mb-4">Build your first competitive deck</p>
          <Button asChild className="bg-primary text-primary-foreground gap-2">
            <Link href="/decks/builder"><Plus className="w-4 h-4" /> Build a Deck</Link>
          </Button>
        </div>
      )}

      {/* Community Decks */}
      <div>
        <h2 className="font-display text-xl font-bold text-foreground mb-5">Community Decks</h2>
        {publicLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3.5 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : publicDecks && publicDecks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicDecks.map((deck) => (
              <Link key={deck.id} href={`/decks/${deck.id}`}>
                <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-foreground truncate flex-1">{deck.name}</h3>
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{deck.format}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{deck.cardCount} cards</p>
                  {deck.estimatedCostUsd && (
                    <p className="text-sm font-bold text-primary mt-2">${parseFloat(String(deck.estimatedCostUsd)).toFixed(2)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No public decks yet. Be the first to share one!</p>
        )}
      </div>
    </div>
  );
}
