import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, BadgeCheck, Package, ShoppingCart, Star, Store, Tag,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONDITIONS, ConditionPill } from "@/components/ConditionPill";

function SellDialog({ productId, productName }: { productId: number; productName: string }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("NM");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.products.createListing.useMutation({
    onSuccess: () => {
      toast.success("Listing published!");
      setOpen(false);
      setPrice(""); setQuantity("1"); setNotes("");
      utils.products.bySlug.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Tag className="w-4 h-4" />Sell yours</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Sell: {productName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">Price (USD)</label>
              <Input type="number" min="0.01" step="0.01" value={price}
                onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-semibold">Quantity</label>
              <Input type="number" min="1" max="999" value={quantity}
                onChange={e => setQuantity(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Condition</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => setCondition(c)}
                  className={condition === c ? "ring-2 ring-blue-500 rounded-full" : ""}>
                  <ConditionPill condition={c} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Notes (optional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Sealed, ships in a box, etc." maxLength={1000} />
          </div>
          <Button className="w-full" disabled={create.isPending || !price || Number(price) <= 0}
            onClick={() => create.mutate({
              productId,
              priceUsd: Number(price),
              quantity: Math.max(1, Number(quantity) || 1),
              condition,
              notes: notes.trim() || undefined,
            })}>
            {create.isPending ? "Publishing…" : "Publish listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [imgError, setImgError] = useState(false);

  const { data, isLoading, error } = trpc.products.bySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug, retry: false },
  );

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success("Added to cart");
      utils.cart.count.invalidate();
      utils.cart.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-[320px_1fr] gap-8">
          <Skeleton className="h-64 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-20 text-center">
        <span className="text-6xl">📦</span>
        <p className="mt-4 font-bold text-lg">Product not found</p>
        <Link href="/shop" className="btn-primary mt-4 inline-flex">Back to Shop</Link>
      </div>
    );
  }

  const { product, sellers } = data;
  const refPrice = product.avgPriceUsd ?? product.minPriceUsd;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="container py-6">
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4"
          style={{ color: "oklch(0.54 0.25 293)" }}>
          <ArrowLeft className="w-4 h-4" />Shop
        </Link>

        <div className="grid md:grid-cols-[320px_1fr] gap-8">
          {/* Product panel */}
          <div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center h-64">
              {!imgError && product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="max-h-full object-contain"
                  onError={() => setImgError(true)} />
              ) : (
                <Package className="w-16 h-16" style={{ color: "oklch(0.75 0.01 240)" }} />
              )}
            </div>
            <h1 className="text-xl font-black mt-4" style={{ color: "oklch(0.18 0.02 240)" }}>{product.name}</h1>
            {product.setName && (
              <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 240)" }}>{product.setName}</p>
            )}
            {product.description && (
              <p className="text-sm mt-3" style={{ color: "oklch(0.35 0.02 240)" }}>{product.description}</p>
            )}
            {refPrice && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
                <p className="text-xs font-bold uppercase" style={{ color: "oklch(0.52 0.015 240)" }}>Reference price</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>
                    ${Number(refPrice).toFixed(2)}
                  </span>
                  {product.minPriceUsd && product.maxPriceUsd && (
                    <span className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>
                      ${Number(product.minPriceUsd).toFixed(2)} – ${Number(product.maxPriceUsd).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sellers panel */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-black text-lg" style={{ color: "oklch(0.18 0.02 240)" }}>
                {sellers.length} {sellers.length === 1 ? "seller" : "sellers"}
              </h2>
              {isAuthenticated ? (
                <SellDialog productId={product.id} productName={product.name} />
              ) : (
                <a href="/login" className="btn-ghost text-sm">Sign in to sell</a>
              )}
            </div>

            {sellers.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                <Store className="w-10 h-10 mx-auto" style={{ color: "oklch(0.75 0.01 240)" }} />
                <p className="mt-3 font-bold" style={{ color: "oklch(0.35 0.02 240)" }}>No active listings yet</p>
                <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 240)" }}>Be the first to sell this product.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sellers.map((s) => (
                  <div key={s.listing.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <Link href={s.sellerUsername ? `/profile/${s.sellerUsername}` : "#"}
                          className="font-bold text-sm hover:underline" style={{ color: "oklch(0.18 0.02 240)" }}>
                          {s.sellerName ?? "Seller"}
                        </Link>
                        {s.sellerIsVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                        {s.sellerHasPhysicalStore && <Store className="w-3.5 h-3.5" style={{ color: "oklch(0.52 0.015 240)" }} />}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>
                        {s.sellerRating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="w-3 h-3" fill="#F59E0B" stroke="#F59E0B" />
                            {Number(s.sellerRating).toFixed(1)}
                          </span>
                        )}
                        <span>{s.sellerTotalSales ?? 0} sales</span>
                        {s.sellerLocation && <span>· {s.sellerLocation}</span>}
                      </div>
                      {s.listing.notes && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: "oklch(0.52 0.015 240)" }}>{s.listing.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ConditionPill condition={s.listing.condition} />
                      <span className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>×{s.listing.quantity}</span>
                      <span className="font-black text-lg" style={{ color: "oklch(0.18 0.02 240)" }}>
                        ${Number(s.listing.priceUsd).toFixed(2)}
                      </span>
                      {isAuthenticated ? (
                        <Button size="sm" className="gap-1.5"
                          disabled={addToCart.isPending}
                          onClick={() => addToCart.mutate({ productListingId: s.listing.id, quantity: 1 })}>
                          <ShoppingCart className="w-4 h-4" />Add
                        </Button>
                      ) : (
                        <a href="/login" className="btn-primary text-sm">Sign in</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
