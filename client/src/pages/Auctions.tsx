import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Clock, Zap, ChevronRight, Gavel, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Countdown Timer ────────────────────────────────────────────────────────
function Countdown({ endsAt }: { endsAt: string | Date }) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s });
      setUrgent(diff < 3600000);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const units = timeLeft.d > 0
    ? [{ v: timeLeft.d, l: "d" }, { v: timeLeft.h, l: "h" }, { v: timeLeft.m, l: "m" }]
    : [{ v: timeLeft.h, l: "h" }, { v: timeLeft.m, l: "m" }, { v: timeLeft.s, l: "s" }];

  return (
    <div className={`flex items-center gap-1 ${urgent ? "text-red-500" : "text-gray-700"}`}>
      <Clock size={12} className="shrink-0" />
      <div className="flex gap-1">
        {units.map(({ v, l }) => (
          <span key={l} className={`text-xs font-black tabular-nums ${urgent ? "text-red-500" : "text-gray-800"}`}>
            {String(v).padStart(2, "0")}{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Bid Dialog ──────────────────────────────────────────────────────────────
function BidDialog({
  open,
  onClose,
  auctionId,
  auctionTitle,
  currentBid,
  onBidSuccess,
}: {
  open: boolean;
  onClose: () => void;
  auctionId: number;
  auctionTitle: string;
  currentBid: number;
  onBidSuccess: () => void;
}) {
  const [bidAmount, setBidAmount] = useState("");
  const minBid = currentBid + 0.01;

  const placeBidMutation = trpc.auctions.placeBid.useMutation({
    onSuccess: (data) => {
      toast.success(`Bid of $${data.newBid.toFixed(2)} placed successfully!`);
      onBidSuccess();
      onClose();
      setBidAmount("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBid = () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= currentBid) {
      toast.error(`Bid must be higher than $${currentBid.toFixed(2)}`);
      return;
    }
    placeBidMutation.mutate({ auctionId, amountUsd: amount });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-blue-600" />
            Place a Bid
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 font-medium truncate">{auctionTitle}</p>
          <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Current Bid</span>
            <span className="text-lg font-black text-blue-600">${currentBid.toFixed(2)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your Bid (min ${minBid.toFixed(2)})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <Input
                type="number"
                min={minBid}
                step="0.01"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={minBid.toFixed(2)}
                className="pl-7 border-gray-200 focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleBid}
              disabled={placeBidMutation.isPending || !bidAmount || parseFloat(bidAmount) <= currentBid}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {placeBidMutation.isPending ? "Placing..." : "Place Bid"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Condition Colors ────────────────────────────────────────────────────────
const conditionColors: Record<string, string> = {
  M: "#10b981", NM: "#22c55e", SP: "#f59e0b", MP: "#f97316", HP: "#ef4444", D: "#991b1b",
};

// ─── Fallback card images for demo auctions ─────────────────────────────────
const DEMO_IMAGES = [
  "https://images.pokemontcg.io/sv3/215_hires.png",
  "https://images.pokemontcg.io/swsh4/188_hires.png",
  "https://images.pokemontcg.io/swsh7/215_hires.png",
  "https://images.pokemontcg.io/swsh11/186_hires.png",
];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Auctions() {
  usePageMeta("Auctions", "Live Pokémon card auctions — bid on rare and graded cards.");
  const { isAuthenticated } = useAuth();
  const [sortBy, setSortBy] = useState("ending_soon");
  const [bidDialog, setBidDialog] = useState<{ open: boolean; auctionId: number; title: string; currentBid: number } | null>(null);

  const utils = trpc.useUtils();
  const { data: auctions, isLoading, refetch } = trpc.auctions.list.useQuery(undefined, {
    refetchInterval: 30000, // poll every 30s for live updates
  });

  const sorted = [...(auctions ?? [])].sort((a, b) => {
    if (sortBy === "ending_soon") return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    if (sortBy === "price_high") return (b.currentBidUsd ?? b.startingBidUsd ?? 0) - (a.currentBidUsd ?? a.startingBidUsd ?? 0);
    if (sortBy === "most_bids") return b.bidCount - a.bidCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalBids = (auctions ?? []).reduce((s, a) => s + a.bidCount, 0);
  const highestBid = (auctions ?? []).reduce((max, a) => {
    const bid = a.currentBidUsd ?? a.startingBidUsd ?? 0;
    return bid > max ? bid : max;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} className="py-10">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <Zap size={12} className="text-yellow-400" />
            Live Auctions
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Card Auctions
          </h1>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Bid on rare holos, PSA graded cards, and vintage sealed products. New auctions added daily.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-white/70 text-sm">
            <div className="text-center">
              <div className="text-xl font-black text-white">{auctions?.length ?? 0}</div>
              <div className="text-xs">Live Auctions</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <div className="text-xl font-black text-white">{totalBids}</div>
              <div className="text-xs">Total Bids</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <div className="text-xl font-black text-white">${highestBid.toFixed(0)}</div>
              <div className="text-xs">Highest Bid</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Sort */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{sorted.length} auctions</span>
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2"
          >
            <option value="ending_soon">Ending Soon</option>
            <option value="price_high">Highest Price</option>
            <option value="most_bids">Most Bids</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <Skeleton className="h-44 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-20">
            <Gavel className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">No Active Auctions</h2>
            <p className="text-gray-400 text-sm mb-6">Check back soon — new auctions are added regularly.</p>
            {isAuthenticated && (
              <Link href="/sell">
                <Button className="bg-blue-600 hover:bg-blue-700">List a Card for Auction</Button>
              </Link>
            )}
          </div>
        )}

        {/* Auction Grid */}
        {!isLoading && sorted.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((auction, idx) => {
              const currentBid = auction.currentBidUsd ?? auction.startingBidUsd ?? 0;
              const isUrgent = new Date(auction.endsAt).getTime() - Date.now() < 3600000;
              const imageUrl = auction.imageUrl ?? DEMO_IMAGES[idx % DEMO_IMAGES.length];
              return (
                <div key={auction.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden poke-card hover:border-blue-200 hover:shadow-md transition-all">
                  {/* Card Image */}
                  <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center" style={{ minHeight: "180px" }}>
                    <img
                      src={imageUrl}
                      alt={auction.cardName ?? auction.title}
                      className="h-36 object-contain drop-shadow-lg"
                      onError={e => { (e.target as HTMLImageElement).src = DEMO_IMAGES[0]; }}
                    />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: conditionColors[auction.condition] ?? "#888" }}>
                        {auction.condition}
                      </span>
                    </div>
                    {isUrgent && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                        ENDING SOON
                      </div>
                    )}
                    {auction.isFoil && (
                      <div className="absolute bottom-3 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        ✨ FOIL
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">{auction.cardName ?? auction.title}</h3>
                      {auction.setName && <p className="text-xs text-gray-400 mt-0.5">{auction.setName}</p>}
                      {auction.language !== "English" && (
                        <Badge className="mt-1 text-[10px]" variant="outline">{auction.language}</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-400">
                          {auction.currentBidUsd ? "Current Bid" : "Starting Bid"}
                        </div>
                        <div className="text-lg font-black text-blue-600">${currentBid.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{auction.bidCount} bids</div>
                        <Countdown endsAt={auction.endsAt} />
                      </div>
                    </div>

                    {auction.fixedPriceUsd && (
                      <div className="text-xs text-gray-400 mb-2">
                        Buy It Now: <span className="font-bold text-green-600">${auction.fixedPriceUsd.toFixed(2)}</span>
                      </div>
                    )}

                    {isAuthenticated ? (
                      <Button
                        className="w-full text-sm font-bold text-white rounded-lg"
                        style={{ background: isUrgent ? "#ef4444" : "oklch(0.52 0.22 255)", border: "none" }}
                        onClick={() => setBidDialog({
                          open: true,
                          auctionId: auction.id,
                          title: auction.cardName ?? auction.title,
                          currentBid,
                        })}
                      >
                        <Gavel size={14} className="mr-1.5" />
                        {isUrgent ? "Bid Now — Ending Soon!" : `Bid (Current: $${currentBid.toFixed(2)})`}
                      </Button>
                    ) : (
                      <a href={getLoginUrl()} className="block w-full text-center text-sm font-bold text-white py-2 rounded-lg" style={{ background: "oklch(0.52 0.22 255)" }}>
                        Sign In to Bid
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Auction CTA */}
        {isAuthenticated && (
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Have rare cards to sell?</h3>
              <p className="text-sm text-gray-500">Create an auction and reach thousands of collectors across the USA.</p>
            </div>
            <Link href="/sell">
              <Button className="text-white font-bold shrink-0" style={{ background: "oklch(0.52 0.22 255)", border: "none" }}>
                <ChevronRight size={16} className="mr-1" />
                List a Card
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Bid Dialog */}
      {bidDialog && (
        <BidDialog
          open={bidDialog.open}
          onClose={() => setBidDialog(null)}
          auctionId={bidDialog.auctionId}
          auctionTitle={bidDialog.title}
          currentBid={bidDialog.currentBid}
          onBidSuccess={() => {
            utils.auctions.list.invalidate();
            refetch();
          }}
        />
      )}
    </div>
  );
}
