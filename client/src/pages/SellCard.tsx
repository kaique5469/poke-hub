import { trpc } from "@/lib/trpc";
import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronRight,
  Search,
  Tag,
  DollarSign,
  CheckCircle,
  ShoppingBag,
  Info,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

const CONDITIONS = [
  {
    value: "M",
    label: "Mint",
    description: "Perfect, unplayed condition",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "NM",
    label: "Near Mint",
    description: "Minimal wear, tournament ready",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  {
    value: "SP",
    label: "Slightly Played",
    description: "Minor wear on edges/corners",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  {
    value: "MP",
    label: "Moderately Played",
    description: "Visible wear, still playable",
    color: "bg-orange-100 text-orange-700 border-orange-200",
  },
  {
    value: "HP",
    label: "Heavily Played",
    description: "Significant wear",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  {
    value: "D",
    label: "Damaged",
    description: "Creases, tears, or major damage",
    color: "bg-gray-100 text-gray-600 border-gray-200",
  },
] as const;

type Condition = (typeof CONDITIONS)[number]["value"];

interface SelectedCard {
  id: string;
  name: string;
  setName: string;
  setId: string;
  imageUrl: string;
  price: number | null;
}

export default function SellCard() {
  const { isAuthenticated } = useAuth();
  const search = useSearch();
  const scannedCardId = new URLSearchParams(search).get("card")?.trim() ?? "";
  const preselectedRef = useRef("");

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — Card Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);

  // Step 2 — Listing Details
  const [condition, setCondition] = useState<Condition>("NM");
  const [language, setLanguage] = useState("English");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: searchResults, isLoading: isSearching } =
    trpc.cards.search.useQuery(
      { q: searchQuery, page: 1, pageSize: 12 },
      { enabled: searchQuery.length >= 2 }
    );
  const scannedCard = trpc.cards.getById.useQuery(
    { id: scannedCardId },
    { enabled: isAuthenticated && Boolean(scannedCardId), retry: false }
  );
  const sellerStatus = trpc.store.connectStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createListingMutation = trpc.listings.create.useMutation({
    onSuccess: () => {
      setStep(3);
    },
    onError: err => toast.error(err.message),
  });

  const handleSelectCard = useCallback(
    (card: {
      id: string;
      name: string;
      set: { name: string; id: string };
      images: { small: string };
      tcgplayer?: {
        prices?: {
          holofoil?: { market?: number };
          normal?: { market?: number };
          reverseHolofoil?: { market?: number };
        };
      };
    }) => {
      const prices = card.tcgplayer?.prices;
      const computedPrice =
        prices?.holofoil?.market ??
        prices?.normal?.market ??
        prices?.reverseHolofoil?.market ??
        null;
      setSelectedCard({
        id: card.id,
        name: card.name,
        setName: card.set.name,
        setId: card.set.id,
        imageUrl: card.images.small,
        price: computedPrice,
      });
      if (computedPrice) setPrice(computedPrice.toFixed(2));
      setStep(2);
    },
    []
  );

  useEffect(() => {
    if (!scannedCard.data || preselectedRef.current === scannedCardId) return;
    preselectedRef.current = scannedCardId;
    handleSelectCard(scannedCard.data);
  }, [handleSelectCard, scannedCard.data, scannedCardId]);

  const handleSubmit = () => {
    if (!selectedCard) return;
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid price.");
      return;
    }
    createListingMutation.mutate({
      cardId: selectedCard.id,
      cardName: selectedCard.name,
      setId: selectedCard.setId,
      setName: selectedCard.setName,
      imageUrl: selectedCard.imageUrl,
      quantity,
      condition,
      language,
      priceUsd: priceNum,
      notes: notes || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center max-w-md w-full">
          <ShoppingBag className="w-14 h-14 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sign in to Sell
          </h1>
          <p className="text-gray-500 mb-6">
            Create an account or sign in to list your Pokémon cards on
            RarityGrid Marketplace.
          </p>
          <a href={getLoginUrl()}>
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Sign In / Register
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (
    sellerStatus.data &&
    (!sellerStatus.data.payoutsEnabled || !sellerStatus.data.termsAccepted)
  ) {
    const needsStore = !sellerStatus.data.hasStore;
    const needsTerms =
      sellerStatus.data.hasStore && !sellerStatus.data.termsAccepted;
    return (
      <div className="min-h-[65vh] bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-violet-600" />
          <h1 className="mt-4 text-2xl font-black text-gray-900">
            {needsStore
              ? "Open your seller store"
              : needsTerms
                ? "Accept the current seller terms"
                : "Complete payout verification"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Sellers must accept the marketplace terms and verify Stripe payouts
            before inventory can appear to buyers.
          </p>
          <Link href={needsStore ? "/open-store" : "/dashboard"}>
            <Button className="mt-6 w-full">
              {needsStore
                ? "Open store"
                : needsTerms
                  ? "Review seller terms"
                  : "Complete Stripe setup"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link
            href="/marketplace"
            className="hover:text-blue-600 transition-colors"
          >
            Marketplace
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-800 font-medium">Sell a Card</span>
        </nav>

        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Sell a Card</h1>
          <p className="text-gray-500 text-sm mt-1">
            List your Pokémon TCG cards on the RarityGrid Marketplace
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Find Card" },
            { n: 2, label: "Set Price" },
            { n: 3, label: "Listed!" },
          ].map(({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={`h-px w-8 ${step > idx ? "bg-blue-500" : "bg-gray-200"}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === n
                      ? "bg-blue-600 text-white"
                      : step > n
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step > n ? <CheckCircle className="w-4 h-4" /> : n}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:block ${step === n ? "text-blue-600" : step > n ? "text-green-600" : "text-gray-400"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ─── STEP 1: Card Search ─── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Find Your Card
              </h2>
              <p className="text-sm text-gray-500">
                Search by card name to find the exact card you want to sell.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="e.g. Charizard, Pikachu VMAX, Mewtwo ex..."
                className="pl-9 border-gray-200 focus:border-blue-400"
              />
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div>
                {isSearching ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="aspect-[3/4] rounded-xl" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : searchResults?.data && searchResults.data.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {searchResults.data.map(card => (
                      <button
                        key={card.id}
                        onClick={() => handleSelectCard(card)}
                        className="group text-left rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all p-2"
                      >
                        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-50 mb-2">
                          <img
                            src={card.images.small}
                            alt={card.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {card.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {card.set.name}
                        </p>
                        {(card.tcgplayer?.prices?.holofoil?.market ??
                          card.tcgplayer?.prices?.normal?.market ??
                          card.tcgplayer?.prices?.reverseHolofoil?.market) && (
                          <p className="text-xs font-bold text-green-600 mt-0.5">
                            $
                            {(card.tcgplayer?.prices?.holofoil?.market ??
                              card.tcgplayer?.prices?.normal?.market ??
                              card.tcgplayer?.prices?.reverseHolofoil
                                ?.market)!.toFixed(2)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      No cards found for "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {searchQuery.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Start typing a card name to search</p>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2: Listing Details ─── */}
        {step === 2 && selectedCard && (
          <div className="space-y-5">
            {/* Selected Card Preview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4">
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.name}
                className="w-20 h-28 object-contain rounded-lg border border-gray-100"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg">
                  {selectedCard.name}
                </h3>
                <p className="text-sm text-gray-500">{selectedCard.setName}</p>
                {selectedCard.price && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-blue-600">
                      Market price:{" "}
                      <strong>${selectedCard.price.toFixed(2)}</strong>
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedCard(null);
                  setStep(1);
                }}
                className="text-gray-400 hover:text-gray-600 self-start"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Condition */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">
                  Card Condition
                </h2>
                <p className="text-xs text-gray-500">
                  Select the condition that best describes your card
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONDITIONS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCondition(c.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      condition === c.value
                        ? `${c.color} border-current shadow-sm`
                        : "border-gray-100 hover:border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-bold">{c.label}</span>
                      {condition === c.value && (
                        <Star className="w-3.5 h-3.5 fill-current" />
                      )}
                    </div>
                    <p className="text-xs opacity-70">{c.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-gray-900">
                Listing Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="pl-8 border-gray-200 focus:border-blue-400"
                    />
                  </div>
                  {selectedCard.price && parseFloat(price) > 0 && (
                    <p
                      className={`text-xs mt-1 ${parseFloat(price) < selectedCard.price * 0.7 ? "text-orange-500" : parseFloat(price) > selectedCard.price * 1.5 ? "text-red-500" : "text-green-600"}`}
                    >
                      {parseFloat(price) < selectedCard.price * 0.7
                        ? "⚠ Below market value"
                        : parseFloat(price) > selectedCard.price * 1.5
                          ? "⚠ Above market value"
                          : "✓ Fair market price"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Include the cost of tracked US shipping in this price.
                  </p>
                </div>

                {/* Quantity */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={quantity}
                    onChange={e =>
                      setQuantity(
                        Math.max(1, Math.min(99, parseInt(e.target.value) || 1))
                      )
                    }
                    className="border-gray-200 focus:border-blue-400"
                  />
                </div>

                {/* Language */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Language
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "English",
                      "Japanese",
                      "Korean",
                      "Chinese",
                      "German",
                      "French",
                      "Spanish",
                      "Italian",
                      "Portuguese",
                    ].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          language === lang
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-200 text-gray-600 hover:border-blue-300"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Notes{" "}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any additional details about the card (e.g. 1st edition, shadowless, PSA graded...)"
                    className="resize-none border-gray-200 focus:border-blue-400 rounded-xl"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {notes.length}/500
                  </p>
                </div>
              </div>

              {/* Summary */}
              {parseFloat(price) > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 mb-2">
                    Listing Summary
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500">Card:</span>
                    <span className="font-medium text-gray-800">
                      {selectedCard.name}
                    </span>
                    <span className="text-gray-500">Condition:</span>
                    <Badge
                      className={`${CONDITIONS.find(c => c.value === condition)?.color} border text-xs w-fit`}
                    >
                      {CONDITIONS.find(c => c.value === condition)?.label}
                    </Badge>
                    <span className="text-gray-500">Price:</span>
                    <span className="font-bold text-green-600">
                      ${parseFloat(price).toFixed(2)} × {quantity}
                    </span>
                    <span className="text-gray-500">Language:</span>
                    <span className="font-medium text-gray-800">
                      {language}
                    </span>
                    <span className="text-gray-500">Estimated payout:</span>
                    <span className="font-bold text-violet-700">
                      ${(parseFloat(price) * quantity * 0.95).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !price ||
                    parseFloat(price) <= 0 ||
                    createListingMutation.isPending
                  }
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {createListingMutation.isPending
                    ? "Listing..."
                    : "List for Sale"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Success ─── */}
        {step === 3 && selectedCard && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              Card Listed!
            </h2>
            <p className="text-gray-500 mb-2">
              <strong>{selectedCard.name}</strong> has been listed on the
              RarityGrid Marketplace.
            </p>
            <p className="text-sm text-gray-400 mb-8">
              Buyers can now find your listing when searching for this card.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/marketplace">
                <Button variant="outline" className="gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  View Marketplace
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setStep(1);
                  setSelectedCard(null);
                  setSearchQuery("");
                  setPrice("");
                  setNotes("");
                  setQuantity(1);
                  setCondition("NM");
                }}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Tag className="w-4 h-4" />
                List Another Card
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
