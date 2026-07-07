import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  BookOpen, Check, ChevronDown, ChevronUp, Copy, Download,
  Minus, Plus, Save, Search, Shield, Trash2, Upload, X,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface DeckEntry {
  cardId: string;
  cardName: string;
  setName?: string;
  setId?: string;
  imageUrl?: string;
  supertype?: string;
  quantity: number;
  priceUsd?: string;
}

const PTCGL_SUPERTYPES: Record<string, string> = {
  "Pokémon": "Pokémon",
  "Trainer": "Trainer",
  "Energy": "Energy",
};

function validateDeck(cards: DeckEntry[], format: string): string[] {
  const errors: string[] = [];
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  if (total !== 60) errors.push(`Deck must have exactly 60 cards (currently ${total})`);

  // Max 4 copies rule (except basic energy)
  for (const card of cards) {
    const isBasicEnergy = card.supertype === "Energy" && !card.cardName.includes("Special");
    if (!isBasicEnergy && card.quantity > 4) {
      errors.push(`${card.cardName}: max 4 copies allowed (you have ${card.quantity})`);
    }
  }

  return errors;
}

function exportDeckText(cards: DeckEntry[], deckName: string): string {
  const pokemon = cards.filter((c) => c.supertype === "Pokémon");
  const trainers = cards.filter((c) => c.supertype === "Trainer");
  const energy = cards.filter((c) => c.supertype === "Energy");
  const other = cards.filter((c) => !c.supertype || !["Pokémon", "Trainer", "Energy"].includes(c.supertype));

  const lines = [`// ${deckName}`, ""];
  if (pokemon.length) {
    lines.push("Pokémon: " + pokemon.reduce((s, c) => s + c.quantity, 0));
    pokemon.forEach((c) => lines.push(`${c.quantity} ${c.cardName} ${c.setId ?? ""}`));
    lines.push("");
  }
  if (trainers.length) {
    lines.push("Trainer: " + trainers.reduce((s, c) => s + c.quantity, 0));
    trainers.forEach((c) => lines.push(`${c.quantity} ${c.cardName} ${c.setId ?? ""}`));
    lines.push("");
  }
  if (energy.length) {
    lines.push("Energy: " + energy.reduce((s, c) => s + c.quantity, 0));
    energy.forEach((c) => lines.push(`${c.quantity} ${c.cardName} ${c.setId ?? ""}`));
    lines.push("");
  }
  if (other.length) {
    other.forEach((c) => lines.push(`${c.quantity} ${c.cardName}`));
  }
  lines.push(`Total Cards: ${cards.reduce((s, c) => s + c.quantity, 0)}`);
  return lines.join("\n");
}

export default function DeckBuilder() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [deckName, setDeckName] = useState("New Deck");
  const [format, setFormat] = useState<"standard" | "expanded" | "unlimited">("standard");
  const [isPublic, setIsPublic] = useState(false);
  const [cards, setCards] = useState<DeckEntry[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const { data: searchResults, isLoading: searching } = trpc.cards.search.useQuery(
    { q: searchQ, pageSize: 12 },
    { enabled: searchQ.length >= 2 }
  );

  const createDeckMutation = trpc.decks.create.useMutation();
  const updateDeckMutation = trpc.decks.update.useMutation();

  const totalCards = useMemo(() => cards.reduce((s, c) => s + c.quantity, 0), [cards]);
  const totalCost = useMemo(() =>
    cards.reduce((s, c) => s + (parseFloat(c.priceUsd ?? "0") * c.quantity), 0), [cards]);
  const errors = useMemo(() => validateDeck(cards, format), [cards, format]);

  const pokémon = cards.filter((c) => c.supertype === "Pokémon");
  const trainers = cards.filter((c) => c.supertype === "Trainer");
  const energy = cards.filter((c) => c.supertype === "Energy");

  const addCard = useCallback((card: { id: string; name: string; set: { name: string; id: string }; images: { small: string }; supertype: string; tcgplayer?: { prices?: Record<string, { market?: number }> } }) => {
    const price = card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market;
    setCards((prev) => {
      const existing = prev.find((c) => c.cardId === card.id);
      if (existing) {
        const isBasicEnergy = card.supertype === "Energy";
        const max = isBasicEnergy ? 99 : 4;
        if (existing.quantity >= max) { toast.error(`Max ${max} copies of ${card.name}`); return prev; }
        return prev.map((c) => c.cardId === card.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        cardId: card.id,
        cardName: card.name,
        setName: card.set.name,
        setId: card.set.id,
        imageUrl: card.images.small,
        supertype: card.supertype,
        quantity: 1,
        priceUsd: price ? price.toFixed(2) : undefined,
      }];
    });
  }, []);

  const updateQuantity = (cardId: string, delta: number) => {
    setCards((prev) =>
      prev.map((c) => c.cardId === cardId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)
        .filter((c) => c.quantity > 0)
    );
  };

  const removeCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.cardId !== cardId));
  };

  const handleSave = async () => {
    if (!isAuthenticated) { toast.error("Please sign in to save decks"); return; }
    setSaving(true);
    try {
      await createDeckMutation.mutateAsync({ name: deckName, format, isPublic });
      // Get the newly created deck id
      const myDecks = await utils.decks.myDecks.fetch();
      const newDeck = myDecks[0];
      if (newDeck) {
        await updateDeckMutation.mutateAsync({
          id: newDeck.id,
          cards,
          cardCount: totalCards,
          estimatedCostUsd: totalCost.toFixed(2),
        });
      }
      toast.success("Deck saved successfully!");
      navigate("/decks");
    } catch {
      toast.error("Failed to save deck. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const text = exportDeckText(cards, deckName);
    navigator.clipboard.writeText(text).then(() => toast.success("Deck copied to clipboard!"));
  };

  const handleDownload = () => {
    const text = exportDeckText(cards, deckName);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${deckName.replace(/\s+/g, "_")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const lines = importText.split("\n").filter((l) => l.trim() && !l.startsWith("//") && !l.startsWith("Total"));
    const newCards: DeckEntry[] = [];
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(.+?)(?:\s+[A-Z]{2,4}\d*)?$/);
      if (match) {
        const qty = parseInt(match[1]);
        const name = match[2].trim();
        newCards.push({ cardId: `import-${name}`, cardName: name, quantity: qty });
      }
    }
    if (newCards.length) {
      setCards(newCards);
      toast.success(`Imported ${newCards.length} card entries`);
      setShowImport(false);
      setImportText("");
    }
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-1">Deck Builder</h1>
          <p className="text-muted-foreground text-sm">Build, validate, and price your 60-card deck</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!cards.length} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!cards.length} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !cards.length}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Deck
          </Button>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-foreground mb-3">Import Deck (PTCGL format)</h3>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"4 Dragapult ex TWM 130\n2 Pidgeot ex OBF 164\n4 Professor's Research SVI 189\n..."}
            className="w-full h-40 bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono"
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleImport} className="bg-primary text-primary-foreground">Import</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Card Search */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Add Cards
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); setSearchQ(searchInput); }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); if (e.target.value.length >= 2) setSearchQ(e.target.value); }}
                  placeholder="Search cards to add…"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                />
              </div>
            </form>

            {/* Search results */}
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
              {searching && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
                      <div className="w-10 h-14 bg-muted rounded" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchResults?.data.map((card) => {
                const price = card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market;
                const inDeck = cards.find((c) => c.cardId === card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => addCard(card as Parameters<typeof addCard>[0])}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left group"
                  >
                    <img src={card.images.small} alt={card.name} className="w-10 h-14 object-contain rounded bg-muted border border-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{card.set.name} · {card.supertype}</p>
                      {price && <p className="text-xs font-bold text-primary">${price.toFixed(2)}</p>}
                    </div>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      inDeck ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                    )}>
                      {inDeck ? <span className="text-xs font-bold">{inDeck.quantity}</span> : <Plus className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
              {searchQ.length >= 2 && !searching && searchResults?.data.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No cards found</p>
              )}
              {searchQ.length < 2 && !searching && (
                <p className="text-xs text-muted-foreground text-center py-6">Type at least 2 characters to search</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Deck Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {/* Deck settings */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-muted-foreground mb-1 block">Deck Name</label>
                <input
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Format</label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                  <SelectTrigger className="bg-background border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="expanded">Expanded</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Visibility</label>
                <button
                  onClick={() => setIsPublic((v) => !v)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors",
                    isPublic ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground"
                  )}
                >
                  {isPublic ? "Public" : "Private"}
                  {isPublic ? <Check className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "text-sm font-bold px-2.5 py-1 rounded-lg",
                  totalCards === 60 ? "bg-[oklch(0.70_0.18_145/0.15)] text-[oklch(0.70_0.18_145)]" :
                  totalCards > 60 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                )}>
                  {totalCards}/60
                </div>
                <span className="text-xs text-muted-foreground">
                  {pokémon.length > 0 && `${pokémon.reduce((s, c) => s + c.quantity, 0)} Pokémon`}
                  {trainers.length > 0 && ` · ${trainers.reduce((s, c) => s + c.quantity, 0)} Trainers`}
                  {energy.length > 0 && ` · ${energy.reduce((s, c) => s + c.quantity, 0)} Energy`}
                </span>
              </div>
              <div className="text-sm font-bold text-primary">
                Est. ${totalCost.toFixed(2)}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  totalCards === 60 ? "bg-[oklch(0.70_0.18_145)]" :
                  totalCards > 60 ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${Math.min((totalCards / 60) * 100, 100)}%` }}
              />
            </div>

            {/* Validation errors */}
            {errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                    <X className="w-3 h-3 shrink-0" /> {err}
                  </p>
                ))}
              </div>
            )}
            {errors.length === 0 && totalCards === 60 && (
              <p className="text-xs text-[oklch(0.70_0.18_145)] flex items-center gap-1.5 mt-2">
                <Check className="w-3 h-3" /> Deck is valid and ready to play!
              </p>
            )}
          </div>

          {/* Card list */}
          {cards.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Search for cards on the left to start building your deck</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {[
                { label: "Pokémon", cards: pokémon },
                { label: "Trainers", cards: trainers },
                { label: "Energy", cards: energy },
                { label: "Other", cards: cards.filter((c) => !["Pokémon", "Trainer", "Energy"].includes(c.supertype ?? "")) },
              ].filter(({ cards: c }) => c.length > 0).map(({ label, cards: sectionCards }) => (
                <div key={label}>
                  <div className="px-4 py-2 bg-muted/30 border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {label} ({sectionCards.reduce((s, c) => s + c.quantity, 0)})
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {sectionCards.map((card) => (
                      <div key={card.cardId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
                        {card.imageUrl && (
                          <img src={card.imageUrl} alt={card.cardName} className="w-8 h-11 object-contain rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{card.cardName}</p>
                          {card.setName && <p className="text-xs text-muted-foreground truncate">{card.setName}</p>}
                        </div>
                        {card.priceUsd && (
                          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                            ${(parseFloat(card.priceUsd) * card.quantity).toFixed(2)}
                          </span>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQuantity(card.cardId, -1)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-foreground">{card.quantity}</span>
                          <button onClick={() => updateQuantity(card.cardId, 1)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeCard(card.cardId)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
