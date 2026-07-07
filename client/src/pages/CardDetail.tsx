import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ShoppingCart, Heart, Star,
  TrendingUp, Package, ChevronRight,
  Store, Tag, AlertCircle, ArrowUpDown, ExternalLink, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const typeColors: Record<string, string> = {
  Fire: "#F08030", Water: "#6890F0", Grass: "#78C850", Electric: "#F8D030",
  Psychic: "#F85888", Fighting: "#C03028", Dragon: "#7038F8", Dark: "#705848",
  Steel: "#B8B8D0", Fairy: "#EE99AC", Normal: "#A8A878", Ice: "#98D8D8",
  Ghost: "#705898", Poison: "#A040A0", Ground: "#E0C068", Rock: "#B8A038",
  Bug: "#A8B820", Flying: "#A890F0", Colorless: "#C8C8C8",
};

const conditionLabels: Record<string, { label: string; color: string }> = {
  M: { label: "Mint", color: "#10b981" },
  NM: { label: "Near Mint", color: "#22c55e" },
  SP: { label: "Slightly Played", color: "#f59e0b" },
  MP: { label: "Moderately Played", color: "#f97316" },
  HP: { label: "Heavily Played", color: "#ef4444" },
  D: { label: "Damaged", color: "#991b1b" },
};

// ─── Store Listing Data ───────────────────────────────────────────────────────
interface StoreListing {
  id: string;
  storeName: string;
  storeColor: string;
  storeBg: string;
  cardName: string;
  variant: string;
  tags: string[];
  condition: string;
  qty: number;
  price: number;
  currency: string;
  originalPrice?: number;
  buyUrl: string;
  storeUrl: string;
  isFeatured?: boolean;
  isReal?: boolean; // true = real API price, false = estimated
}

function buildStoreListings(
  cardName: string,
  setName: string,
  tcgUrl: string,
  priceVariants: [string, any][],
  cmPrices?: {
    cardmarket: {
      lowest_near_mint: number | null;
      lowest_near_mint_DE: number | null;
      lowest_near_mint_FR: number | null;
      avg_30d: number | null;
      avg_7d: number | null;
      available_items: number | null;
      graded_psa10: number | null;
    };
    tcgplayer: { market_price: number | null; mid_price: number | null };
  } | null
): StoreListing[] {
  const baseQPokemon = encodeURIComponent("Pokemon " + cardName + " " + setName);
  const listings: StoreListing[] = [];

  // ── CardMarket (real prices from API) ──
  if (cmPrices?.cardmarket?.lowest_near_mint) {
    const cm = cmPrices.cardmarket;
    listings.push({
      id: "cardmarket-nm",
      storeName: "CardMarket",
      storeColor: "#16a34a",
      storeBg: "#f0fdf4",
      cardName,
      variant: "Near Mint",
      tags: ["EU", cm.available_items ? `${cm.available_items} avail.` : ""].filter(Boolean),
      condition: "NM",
      qty: (cm.available_items ?? 1) as number,
      price: cm.lowest_near_mint!,
      currency: "EUR",
      buyUrl: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}`,
      storeUrl: "https://www.cardmarket.com",
      isReal: true,
      isFeatured: !cmPrices?.tcgplayer?.market_price,
    });

    // DE seller
    if (cm.lowest_near_mint_DE && cm.lowest_near_mint_DE !== cm.lowest_near_mint) {
      listings.push({
        id: "cardmarket-de",
        storeName: "CardMarket DE",
        storeColor: "#15803d",
        storeBg: "#dcfce7",
        cardName,
        variant: "Near Mint — DE",
        tags: ["EU", "DE"],
        condition: "NM",
        qty: 1,
        price: cm.lowest_near_mint_DE,
        currency: "EUR",
        buyUrl: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}&sellerCountry=3`,
        storeUrl: "https://www.cardmarket.com",
        isReal: true,
      });
    }

    // FR seller
    if (cm.lowest_near_mint_FR) {
      listings.push({
        id: "cardmarket-fr",
        storeName: "CardMarket FR",
        storeColor: "#166534",
        storeBg: "#bbf7d0",
        cardName,
        variant: "Near Mint — FR",
        tags: ["EU", "FR"],
        condition: "NM",
        qty: 1,
        price: cm.lowest_near_mint_FR,
        currency: "EUR",
        buyUrl: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}&sellerCountry=2`,
        storeUrl: "https://www.cardmarket.com",
        isReal: true,
      });
    }
  }

  // ── TCGPlayer (real price from CardMarket API or pokemontcg.io) ──
  const tcgMarket = cmPrices?.tcgplayer?.market_price ?? priceVariants[0]?.[1]?.market;
  const tcgMid = cmPrices?.tcgplayer?.mid_price ?? priceVariants[0]?.[1]?.mid;
  if (tcgMarket) {
    listings.push({
      id: "tcgplayer-market",
      storeName: "TCGPlayer",
      storeColor: "#1a73e8",
      storeBg: "#eff6ff",
      cardName,
      variant: "Holofoil",
      tags: ["Market Price"],
      condition: "NM",
      qty: 99,
      price: tcgMarket,
      currency: "USD",
      originalPrice: tcgMid && tcgMid > tcgMarket * 1.05 ? tcgMid : undefined,
      buyUrl: tcgUrl,
      storeUrl: "https://www.tcgplayer.com",
      isReal: true,
      isFeatured: !cmPrices?.cardmarket?.lowest_near_mint,
    });
  }

  // TCGPlayer variants from pokemontcg.io
  priceVariants.forEach(([variant, p], i) => {
    if (!p?.market && !p?.low) return;
    if (i === 0 && tcgMarket) return; // already added above
    const price = p.market ?? p.low;
    const variantLabel = variant.replace(/([A-Z])/g, " $1").trim();
    const tags: string[] = [];
    if (variant.toLowerCase().includes("holo")) tags.push("Holo");
    if (variant.toLowerCase().includes("reverse")) tags.push("Reverse");
    if (variant.toLowerCase().includes("1st")) tags.push("1st Ed.");
    listings.push({
      id: `tcgplayer-${i}`,
      storeName: "TCGPlayer",
      storeColor: "#1a73e8",
      storeBg: "#eff6ff",
      cardName,
      variant: variantLabel,
      tags,
      condition: "NM",
      qty: 99,
      price,
      currency: "USD",
      buyUrl: tcgUrl,
      storeUrl: "https://www.tcgplayer.com",
      isReal: true,
    });
  });

  // ── eBay ──
  const ebayBase = tcgMarket ?? cmPrices?.cardmarket?.lowest_near_mint;
  if (ebayBase) {
    listings.push({
      id: "ebay",
      storeName: "eBay",
      storeColor: "#e53238",
      storeBg: "#fff7ed",
      cardName,
      variant: "Holofoil",
      tags: ["BIN"],
      condition: "NM",
      qty: 10,
      price: +(ebayBase * 0.95).toFixed(2),
      currency: "USD",
      buyUrl: `https://www.ebay.com/sch/i.html?_nkw=${baseQPokemon}&_sacat=183454&LH_BIN=1&_sop=15`,
      storeUrl: "https://www.ebay.com",
      isReal: false,
    });
  }

  // TCGPlayer Direct
  const directLow = priceVariants[0]?.[1]?.directLow;
  if (directLow) {
    listings.push({
      id: "tcgplayer-direct",
      storeName: "TCGPlayer Direct",
      storeColor: "#0055b3",
      storeBg: "#dbeafe",
      cardName,
      variant: "Holofoil",
      tags: ["Direct", "Fast Ship"],
      condition: "NM",
      qty: 5,
      price: directLow,
      currency: "USD",
      buyUrl: tcgUrl,
      storeUrl: "https://www.tcgplayer.com",
      isReal: true,
    });
  }

  // Troll & Toad
  if (tcgMarket) {
    listings.push({
      id: "trollandtoad",
      storeName: "Troll & Toad",
      storeColor: "#7c3aed",
      storeBg: "#f5f3ff",
      cardName,
      variant: "Holofoil",
      tags: [],
      condition: "NM",
      qty: 3,
      price: +(tcgMarket * 1.05).toFixed(2),
      currency: "USD",
      buyUrl: `https://www.trollandtoad.com/pokemon/${encodeURIComponent(cardName.toLowerCase().replace(/\s+/g, "-"))}/1`,
      storeUrl: "https://www.trollandtoad.com",
      isReal: false,
    });
  }

  // CoolStuffInc
  if (tcgMarket) {
    listings.push({
      id: "coolstuffinc",
      storeName: "CoolStuffInc",
      storeColor: "#0891b2",
      storeBg: "#ecfeff",
      cardName,
      variant: "Holofoil",
      tags: ["Price Match"],
      condition: "NM",
      qty: 2,
      price: +(tcgMarket * 1.08).toFixed(2),
      currency: "USD",
      buyUrl: `https://www.coolstuffinc.com/main_search.php?q=${encodeURIComponent(cardName)}&search_category=Pokemon`,
      storeUrl: "https://www.coolstuffinc.com",
      isReal: false,
    });
  }

  // Amazon
  if (tcgMarket) {
    listings.push({
      id: "amazon",
      storeName: "Amazon",
      storeColor: "#ff9900",
      storeBg: "#fffbeb",
      cardName,
      variant: "Sealed / Singles",
      tags: ["Prime"],
      condition: "NM",
      qty: 8,
      price: +(tcgMarket * 1.15).toFixed(2),
      currency: "USD",
      buyUrl: `https://www.amazon.com/s?k=${encodeURIComponent("Pokemon TCG " + cardName + " " + setName)}&i=toys-and-games`,
      storeUrl: "https://www.amazon.com",
      isReal: false,
    });
  }

  return listings.filter((l) => l.price > 0).sort((a, b) => {
    // Sort real prices first, then by price ascending
    if (a.isReal && !b.isReal) return -1;
    if (!a.isReal && b.isReal) return 1;
    return a.price - b.price;
  });
}

// ─── Store Row Component ──────────────────────────────────────────────────────
function StoreRow({ listing }: { listing: StoreListing }) {
  const cond = conditionLabels[listing.condition] ?? { label: listing.condition, color: "#888" };

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-blue-50/40 transition-colors group">
      {/* Store Logo / Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-8 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0 leading-tight text-center px-1"
            style={{ background: listing.storeColor }}
          >
            {listing.storeName.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </div>
          <div>
            <div className="font-bold text-gray-800 text-xs leading-tight">{listing.storeName}</div>
            <div className="flex items-center gap-1">
              {listing.isFeatured && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Best Price</span>
              )}
              {listing.isReal ? (
                <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Live</span>
              ) : (
                <span className="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">Est.</span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Card / Variant */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-700 font-medium">{listing.cardName} — {listing.variant}</span>
          {listing.tags.filter(t => !t.includes("avail.")).map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
              style={{
                color: listing.storeColor,
                borderColor: listing.storeColor + "44",
                background: listing.storeBg,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div>
          <span className="font-black text-base" style={{ color: listing.storeColor }}>
            {listing.currency === "EUR" ? "€" : "$"}{listing.price.toFixed(2)}
          </span>
          {listing.currency === "EUR" && (
            <div className="text-[9px] text-gray-400">EUR</div>
          )}
          {listing.originalPrice && (
            <div className="text-[10px] text-gray-400 line-through">${listing.originalPrice.toFixed(2)}</div>
          )}
        </div>
      </td>

      {/* Condition */}
      <td className="px-4 py-3 text-center">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: cond.color }}
        >
          {listing.condition}
        </span>
      </td>

      {/* Qty */}
      <td className="px-4 py-3 text-center text-xs text-gray-500">
        <span className="font-medium">{listing.qty > 50 ? "50+" : listing.qty}</span>
        <span className="text-gray-300 ml-1">avail.</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <a
            href={listing.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-opacity hover:opacity-90"
            style={{ background: "#16a34a" }}
          >
            <ShoppingCart size={11} />
            Buy
          </a>
          <a
            href={listing.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors bg-white"
          >
            <ExternalLink size={10} />
            Visit
          </a>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [selectedCondition, setSelectedCondition] = useState("NM");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: card, isLoading } = trpc.cards.getById.useQuery(
    { id: id! },
    { enabled: !!id, retry: false }
  );

  // Fetch real CardMarket API prices
  const { data: externalPrices, isLoading: pricesLoading } = trpc.cards.getExternalPrices.useQuery(
    { id: id! },
    { enabled: !!id, retry: false, staleTime: 60 * 60 * 1000 }
  );

  // TCG Arena marketplace listings (real sellers)
  const { data: listingsData } = trpc.listings.getByCardWithSellers.useQuery(
    { cardId: id! },
    { enabled: !!id, retry: false }
  );
  const listings = listingsData ?? [];

  const utils = trpc.useUtils();
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success("Added to cart!");
      utils.cart.count.invalidate();
      utils.cart.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const addToBinder = trpc.binder.add.useMutation({
    onSuccess: () => toast.success("Card added to your binder!"),
    onError: () => toast.error("Failed to add card. Please sign in."),
  });

  // Compute derived values — must be before any early returns to satisfy Rules of Hooks
  const prices = card?.tcgplayer?.prices ?? {};
  const priceVariants = Object.entries(prices) as [string, any][];

  // Best price: prefer real CardMarket API data, fallback to pokemontcg.io
  const bestPrice = useMemo(() => {
    const tcgMarket = externalPrices?.prices?.tcgplayer?.market_price;
    const cmLow = externalPrices?.prices?.cardmarket?.lowest_near_mint;
    const ptcgMarket = priceVariants.reduce((best, [, v]) => {
      const m = v?.market ?? 0;
      return m > best ? m : best;
    }, 0);
    return tcgMarket ?? ptcgMarket ?? cmLow ?? 0;
  }, [externalPrices, priceVariants]);

  const tcgplayerUrl = card?.tcgplayer?.url ?? `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent((card?.name ?? "") + " " + (card?.set?.name ?? ""))}&view=grid`;
  const cardName = card?.name ?? "";
  const setName = card?.set?.name ?? "";

  // Other printings / editions of the same card
  const { data: printingsData } = trpc.pokemon.getTCGCards.useQuery(
    { name: cardName, page: 1, pageSize: 18 },
    { enabled: !!cardName, staleTime: 60 * 60 * 1000 }
  );
  const otherPrintings = (printingsData?.cards ?? []).filter((c) => c.id !== id);

  usePageMeta(
    cardName ? `${cardName} · ${setName}` : undefined,
    cardName ? `${cardName} from ${setName} — live prices, sellers, price history and other printings on TCG Arena.` : undefined,
    card?.images?.large ?? card?.images?.small,
  );

  // Build store listings with real CardMarket prices
  const storeListings = useMemo(() => {
    if (!card) return [];
    const rows = buildStoreListings(cardName, setName, tcgplayerUrl, priceVariants, externalPrices?.prices ?? null);
    return sortAsc ? rows : [...rows].reverse();
  }, [card, cardName, setName, tcgplayerUrl, priceVariants, externalPrices, sortAsc]);

  // Price history from CardMarket API (real data) or simulated fallback
  const priceHistory = useMemo(() => {
    if (externalPrices?.history && externalPrices.history.length > 0) {
      return externalPrices.history.map((h) => ({
        date: new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        "CardMarket (€)": h.cm_low,
        "TCGPlayer ($)": h.tcg_market,
      }));
    }
    // Simulated fallback
    if (bestPrice <= 0) return [];
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      "TCGPlayer ($)": +(bestPrice * (0.85 + Math.random() * 0.3)).toFixed(2),
    }));
  }, [externalPrices, bestPrice]);

  const hasRealHistory = externalPrices?.history && externalPrices.history.length > 0;

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="aspect-[2/3] rounded-2xl" />
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="container py-16 text-center">
        <div className="text-6xl mb-4">🃏</div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Card not found</h2>
        <Link href="/cards"><Button variant="outline" className="mt-4">Back to Cards</Button></Link>
      </div>
    );
  }

  const cmData = externalPrices?.prices?.cardmarket;
  const tcgData = externalPrices?.prices?.tcgplayer;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
          <ChevronRight size={14} />
          <Link href="/cards" className="hover:text-blue-600 transition-colors">Cards</Link>
          <ChevronRight size={14} />
          <Link href={`/sets/${card.set?.id}`} className="hover:text-blue-600 transition-colors">{card.set?.name}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-700 font-medium truncate max-w-[200px]">{card.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Card Image ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <img
                src={card.images?.large ?? card.images?.small}
                alt={card.name}
                className="w-full max-w-xs rounded-2xl shadow-2xl transition-transform group-hover:scale-105"
                style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.15))" }}
              />
              {card.rarity && (
                <Badge className="absolute top-3 right-3 text-xs font-bold" style={{ background: "#4f8ef7", color: "white", border: "none" }}>
                  {card.rarity}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 w-full max-w-xs">
              <Button
                variant="outline"
                className="flex-1 gap-2 text-sm font-semibold"
                onClick={() => {
                  if (!isAuthenticated) { toast.error("Please sign in to add to binder"); return; }
                  addToBinder.mutate({ cardId: card.id, cardName: card.name, imageUrl: card.images?.small ?? "", quantity: 1, condition: selectedCondition as any });
                }}
              >
                <Heart size={16} /> Add to Binder
              </Button>
              <Button
                className="flex-1 gap-2 text-sm font-semibold text-white"
                style={{ background: "oklch(0.54 0.25 293)", border: "none" }}
                onClick={() => window.open(tcgplayerUrl, "_blank")}
              >
                <ShoppingCart size={16} /> Buy
              </Button>
            </div>

            {/* Price Summary Card */}
            <div className="w-full max-w-xs bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Market Price</span>
                {pricesLoading ? (
                  <RefreshCw size={12} className="text-gray-300 animate-spin" />
                ) : (
                  <Tag size={14} className="text-gray-400" />
                )}
              </div>

              {pricesLoading ? (
                <Skeleton className="h-9 w-24 mb-1" />
              ) : bestPrice > 0 ? (
                <>
                  <div className="text-3xl font-black text-blue-600 mb-1">${bestPrice.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 mb-3">
                    {tcgData?.market_price ? "via TCGPlayer · Live" : "via pokemontcg.io"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400 mb-3">No price data yet</div>
              )}

              {/* TCGPlayer tiers */}
              {priceVariants.length > 0 && (
                <div className="mt-1 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  {(["low", "mid", "high"] as const).map((tier) => {
                    const val = priceVariants[0]?.[1]?.[tier];
                    return val ? (
                      <div key={tier}>
                        <div className="text-xs font-bold text-gray-800">${val.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{tier}</div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              {/* CardMarket tiers */}
              {cmData?.lowest_near_mint && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">CardMarket (EUR)</div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <div className="text-xs font-bold text-green-700">€{cmData.lowest_near_mint.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-400">NM Low</div>
                    </div>
                    {cmData.avg_30d && (
                      <div>
                        <div className="text-xs font-bold text-green-600">€{cmData.avg_30d.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400">30d Avg</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PSA grades */}
              {cmData?.graded_psa10 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">Graded (PSA)</div>
                  <div className="flex gap-3 text-center justify-center">
                    <div>
                      <div className="text-xs font-black text-yellow-600">€{cmData.graded_psa10.toFixed(0)}</div>
                      <div className="text-[10px] text-gray-400">PSA 10</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Card Info ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                  {card.name}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {card.types?.map((t: string) => (
                  <span key={t} className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: typeColors[t] ?? "#888" }}>
                    {t}
                  </span>
                ))}
                <span className="text-sm text-gray-500">{card.set?.name}</span>
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm text-gray-500">#{card.number}</span>
                {card.artist && <span className="text-xs text-gray-400">Illus. {card.artist}</span>}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="buy">
              <TabsList className="bg-gray-100 p-1 rounded-xl flex-wrap h-auto gap-1">
                <TabsTrigger value="buy" className="rounded-lg text-sm font-semibold">
                  <Store size={13} className="mr-1.5" />
                  Where to Buy
                </TabsTrigger>
                <TabsTrigger value="prices" className="rounded-lg text-sm font-semibold">Prices</TabsTrigger>
                <TabsTrigger value="sellers" className="rounded-lg text-sm font-semibold">Sellers ({listings?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg text-sm font-semibold">Price History</TabsTrigger>
                <TabsTrigger value="info" className="rounded-lg text-sm font-semibold">Card Info</TabsTrigger>
              </TabsList>

              {/* ─── WHERE TO BUY Tab ─────────────────────────────────────── */}
              <TabsContent value="buy" className="mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pricesLoading ? (
                        <RefreshCw size={12} className="text-blue-400 animate-spin" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                      )}
                      <span className="text-xs font-semibold text-gray-600">
                        {storeListings.length} listings found for <strong>{card.name}</strong>
                        {externalPrices?.prices && (
                          <span className="ml-2 text-green-600 font-normal">· Live prices from CardMarket API</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => setSortAsc(!sortAsc)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium"
                    >
                      <ArrowUpDown size={12} />
                      Price {sortAsc ? "↑" : "↓"}
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {pricesLoading ? (
                      <div className="p-6 space-y-3">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                      </div>
                    ) : storeListings.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-semibold">Store</th>
                              <th className="text-left px-4 py-2.5 text-xs text-gray-400 font-semibold">Variant</th>
                              <th className="text-right px-4 py-2.5 text-xs text-gray-400 font-semibold">
                                <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 ml-auto hover:text-blue-600 transition-colors">
                                  Price <ArrowUpDown size={10} />
                                </button>
                              </th>
                              <th className="text-center px-4 py-2.5 text-xs text-gray-400 font-semibold">Cond.</th>
                              <th className="text-center px-4 py-2.5 text-xs text-gray-400 font-semibold">Qty</th>
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {storeListings.map((listing) => (
                              <StoreRow key={listing.id} listing={listing} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-10 text-center text-gray-400">
                        <Store size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">No price data available</p>
                        <p className="text-xs mt-1">This card may be too new. Check stores directly:</p>
                        <div className="flex gap-2 justify-center mt-3 flex-wrap">
                          <a href={tcgplayerUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            style={{ background: "#e5a00d" }}>
                            <ExternalLink size={11} /> TCGPlayer
                          </a>
                          <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent("Pokemon " + cardName + " " + setName)}&_sacat=183454&LH_BIN=1`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            style={{ background: "#e53238" }}>
                            <ExternalLink size={11} /> eBay
                          </a>
                          <a href={`https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardName)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            style={{ background: "#16a34a" }}>
                            <ExternalLink size={11} /> CardMarket
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ─── Prices Tab ──────────────────────────────────────────── */}
              <TabsContent value="prices" className="mt-4 space-y-4">
                {/* CardMarket real prices */}
                {pricesLoading ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : cmData ? (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 bg-green-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-green-600" />
                        <h3 className="font-bold text-sm text-gray-700">CardMarket Live Prices (EUR)</h3>
                      </div>
                      <span className="text-[10px] text-green-600 font-semibold bg-green-100 px-2 py-0.5 rounded-full">Live</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                      {[
                        { label: "NM Low", val: cmData.lowest_near_mint, color: "text-green-700" },
                        { label: "30d Avg", val: cmData.avg_30d, color: "text-blue-600" },
                        { label: "7d Avg", val: cmData.avg_7d, color: "text-purple-600" },
                        { label: "DE Low", val: cmData.lowest_near_mint_DE, color: "text-gray-700" },
                        { label: "FR Low", val: cmData.lowest_near_mint_FR, color: "text-gray-700" },
                        { label: "Available", val: null, extra: cmData.available_items ? `${cmData.available_items} sellers` : null },
                      ].filter(x => x.val || x.extra).map(({ label, val, color, extra }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                          <div className="text-xs text-gray-400 mb-1">{label}</div>
                          {val ? (
                            <div className={`font-black text-sm ${color ?? "text-gray-800"}`}>€{val.toFixed(2)}</div>
                          ) : (
                            <div className="font-bold text-sm text-gray-600">{extra}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Graded prices */}
                    {(cmData.graded_psa10 || cmData.graded_psa9) && (
                      <div className="px-4 pb-4">
                        <div className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">Graded Prices</div>
                        <div className="flex gap-3">
                          {cmData.graded_psa10 && (
                            <div className="bg-yellow-50 rounded-lg px-3 py-2 text-center border border-yellow-100">
                              <div className="font-black text-yellow-700">€{cmData.graded_psa10.toFixed(0)}</div>
                              <div className="text-[10px] text-gray-400">PSA 10</div>
                            </div>
                          )}
                          {cmData.graded_psa9 && (
                            <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
                              <div className="font-black text-gray-700">€{(cmData as any).graded_psa9?.toFixed(0)}</div>
                              <div className="text-[10px] text-gray-400">PSA 9</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* TCGPlayer prices from pokemontcg.io */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {priceVariants.length > 0 ? (
                    <div>
                      <div className="px-4 py-3 bg-blue-50 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-gray-700">TCGPlayer Prices (USD)</h3>
                        {card.tcgplayer?.updatedAt && (
                          <span className="text-xs text-gray-400">Updated {card.tcgplayer.updatedAt}</span>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-xs text-gray-400 font-semibold">Variant</th>
                            <th className="text-right px-4 py-2 text-xs text-gray-400 font-semibold">Low</th>
                            <th className="text-right px-4 py-2 text-xs text-gray-400 font-semibold">Mid</th>
                            <th className="text-right px-4 py-2 text-xs text-gray-400 font-semibold">Market</th>
                            <th className="text-right px-4 py-2 text-xs text-gray-400 font-semibold">High</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceVariants.map(([variant, p]) => (
                            <tr key={variant} className="border-b border-gray-50 last:border-0 hover:bg-blue-50 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-gray-700 capitalize">{variant.replace(/([A-Z])/g, " $1").trim()}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500">{p?.low ? `$${p.low.toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500">{p?.mid ? `$${p.mid.toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-blue-600">{p?.market ? `$${p.market.toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500">{p?.high ? `$${p.high.toFixed(2)}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : tcgData?.market_price ? (
                    <div>
                      <div className="px-4 py-3 bg-blue-50 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-gray-700">TCGPlayer Market Price (via CardMarket API)</h3>
                        <span className="text-[10px] text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-4">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <div className="text-xs text-gray-400 mb-1">Market Price</div>
                          <div className="font-black text-blue-600 text-lg">€{tcgData.market_price.toFixed(2)}</div>
                        </div>
                        {tcgData.mid_price && (
                          <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 mb-1">Mid Price</div>
                            <div className="font-black text-gray-700 text-lg">€{tcgData.mid_price.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-semibold text-gray-600 mb-1">No TCGPlayer price data yet</p>
                      <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
                        This card may be too new or not yet listed on TCGPlayer.
                      </p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        <a href={tcgplayerUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white"
                          style={{ background: "#e5a00d" }}>
                          <ExternalLink size={12} /> Check TCGPlayer
                        </a>
                        <a href={`https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white"
                          style={{ background: "#16a34a" }}>
                          <ExternalLink size={12} /> CardMarket
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ─── Sellers Tab ─────────────────────────────────────────── */}
              <TabsContent value="sellers" className="mt-4">
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {listings && listings.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Seller</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold">Condition</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold">Qty</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-semibold">Price</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {listings.map((l) => {
                          const cond = conditionLabels[l.condition] ?? { label: l.condition, color: "#888" };
                          return (
                            <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-blue-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                    {l.seller.name?.[0] ?? "?"}
                                  </div>
                                  <div>
                                    <Link href={l.seller.username ? `/profile/${l.seller.username}` : "#"}
                                      className="font-semibold text-gray-800 text-xs hover:underline flex items-center gap-1">
                                      {l.seller.name ?? "Seller"}
                                      {l.seller.isVerified && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded-full">✓</span>}
                                      {l.seller.hasPhysicalStore && <Store size={9} className="text-gray-400" />}
                                    </Link>
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                          <Star key={i} size={9} className={i < Math.round(l.seller.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                                        ))}
                                      </div>
                                      <span className="text-[9px] text-gray-400">({l.seller.totalSales} sales)</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cond.color }}>
                                    {cond.label}
                                  </span>
                                  {l.isFoil && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">Foil</span>}
                                  {l.isFirstEdition && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">1st Ed.</span>}
                                  {l.language !== "English" && <span className="text-[9px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full">{l.language}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600 text-xs">{l.quantity}</td>
                              <td className="px-4 py-3 text-right font-black text-blue-600">${Number(l.priceUsd).toFixed(2)}</td>
                              <td className="px-4 py-3 text-right">
                                <Button size="sm" className="text-xs h-7 px-3 text-white"
                                  style={{ background: "oklch(0.54 0.25 293)", border: "none" }}
                                  disabled={addToCart.isPending}
                                  onClick={() => {
                                    if (!isAuthenticated) { toast.error("Sign in to add to cart"); return; }
                                    addToCart.mutate({ listingId: l.id, quantity: 1 });
                                  }}>
                                  <ShoppingCart size={11} className="mr-1" /> Add
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No TCG Arena sellers listed yet</p>
                      <p className="text-xs mt-1">Be the first to sell this card on TCG Arena!</p>
                      <Link href="/sell">
                        <Button size="sm" className="mt-3 text-xs text-white" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                          List for Sale
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ─── Price History Tab ───────────────────────────────────── */}
              <TabsContent value="history" className="mt-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-700">
                      {hasRealHistory ? "90-Day Price History" : "30-Day Price History (Simulated)"}
                    </h3>
                    {hasRealHistory && (
                      <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">Live from CardMarket</span>
                    )}
                  </div>
                  {pricesLoading ? (
                    <Skeleton className="h-56 w-full rounded-lg" />
                  ) : priceHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(priceHistory.length / 6)} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                        <Tooltip />
                        {hasRealHistory ? (
                          <>
                            <Line type="monotone" dataKey="CardMarket (€)" stroke="#16a34a" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="TCGPlayer ($)" stroke="#4f8ef7" strokeWidth={2} dot={false} connectNulls />
                            <Legend />
                          </>
                        ) : (
                          <Line type="monotone" dataKey="TCGPlayer ($)" stroke="#4f8ef7" strokeWidth={2} dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                      No price history available for this card yet.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ─── Card Info Tab ───────────────────────────────────────── */}
              <TabsContent value="info" className="mt-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: "Set", value: card.set?.name },
                      { label: "Number", value: `${card.number}/${card.set?.printedTotal ?? card.set?.total}` },
                      { label: "Rarity", value: card.rarity },
                      { label: "Artist", value: card.artist },
                      { label: "HP", value: card.hp },
                      { label: "Stage", value: card.subtypes?.join(", ") },
                      { label: "Retreat Cost", value: card.retreatCost?.length ? `${card.retreatCost.length} ⚡` : "—" },
                      { label: "Regulation Mark", value: (card as any).regulationMark ?? "—" },
                    ].map(({ label, value }) => value ? (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <dt className="text-xs text-gray-400 font-medium mb-0.5">{label}</dt>
                        <dd className="font-bold text-gray-800 text-sm">{value}</dd>
                      </div>
                    ) : null)}
                  </dl>

                  {card.attacks && card.attacks.length > 0 && (
                    <div>
                      <h3 className="font-bold text-sm text-gray-700 mb-3">Attacks</h3>
                      <div className="space-y-2">
                        {card.attacks.map((atk: any) => (
                          <div key={atk.name} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-gray-800">{atk.name}</span>
                              <span className="font-black text-blue-600">{atk.damage}</span>
                            </div>
                            {atk.text && <p className="text-xs text-gray-500">{atk.text}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {card.weaknesses && card.weaknesses.length > 0 && (
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-xs text-gray-400 font-medium block mb-1">Weakness</span>
                        {card.weaknesses.map((w: any) => (
                          <span key={w.type} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white mr-1" style={{ background: typeColors[w.type] ?? "#888" }}>
                            {w.type} {w.value}
                          </span>
                        ))}
                      </div>
                      {card.resistances && card.resistances.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400 font-medium block mb-1">Resistance</span>
                          {card.resistances.map((r: any) => (
                            <span key={r.type} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white mr-1" style={{ background: typeColors[r.type] ?? "#888" }}>
                              {r.type} {r.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* ─── Other Printings / Editions ──────────────────────────── */}
            {otherPrintings.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <RefreshCw size={13} className="text-blue-500" />
                    Other Printings of {card.name}
                  </h3>
                  <span className="text-xs text-gray-400">{otherPrintings.length} edition{otherPrintings.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {otherPrintings.map((p) => (
                    <Link key={p.id} href={`/cards/${p.id}`}
                      className="shrink-0 w-24 group text-center">
                      <img src={p.image} alt={p.name} loading="lazy"
                        className="w-24 rounded-lg shadow group-hover:scale-105 group-hover:shadow-lg transition-all" />
                      <div className="text-[10px] font-semibold text-gray-600 mt-1.5 truncate">{p.set}</div>
                      <div className="text-[9px] text-gray-400 truncate">#{p.number}{p.rarity ? ` · ${p.rarity}` : ""}</div>
                      {(() => { const m = p.price?.market ?? p.price?.low; return m ? <div className="text-[10px] font-black text-blue-600">${m.toFixed(2)}</div> : null; })()}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
