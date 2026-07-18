import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CreditCard, LockKeyhole, Minus, Package, Plus, ShieldCheck, ShoppingCart, Star, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ConditionPill } from "@/components/ConditionPill";

interface CartRow {
  item: { id: number; quantity: number; listingId: number | null; productListingId: number | null };
  cardListing: {
    id: number; cardName: string; setName: string | null; imageUrl: string | null;
    condition: string; priceUsd: string; quantity: number; isFoil: boolean; cardId: string;
  } | null;
  productListing: { id: number; priceUsd: string; quantity: number; condition: string } | null;
  productName: string | null;
  productImageUrl: string | null;
  productSlug: string | null;
  seller: { id: number; name: string | null; username: string | null; sellerRating: string | null } | null;
}

function lineInfo(row: CartRow) {
  const unit = Number(row.cardListing?.priceUsd ?? row.productListing?.priceUsd ?? 0);
  const stock = row.cardListing?.quantity ?? row.productListing?.quantity ?? 0;
  const name = row.cardListing?.cardName ?? row.productName ?? "Item";
  const img = row.cardListing?.imageUrl ?? row.productImageUrl;
  const href = row.cardListing ? `/cards/${row.cardListing.cardId}` : row.productSlug ? `/shop/${row.productSlug}` : "#";
  const condition = row.cardListing?.condition ?? row.productListing?.condition;
  return { unit, stock, name, img, href, condition };
}

export default function Cart() {
  const { isAuthenticated, loading } = useAuth();
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const utils = trpc.useUtils();

  const { data: rows, isLoading } = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });

  const invalidate = () => {
    utils.cart.get.invalidate();
    utils.cart.count.invalidate();
  };

  const update = trpc.cart.update.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const clear = trpc.cart.clear.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const stripeAvailable = trpc.cart.stripeAvailable.useQuery();
  const stripeCheckout = trpc.cart.stripeCheckout.useMutation({
    onSuccess: (res) => {
      invalidate();
      utils.orders.myPurchases.invalidate();
      window.location.href = res.checkoutUrl;
    },
    onError: (e) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const map = new Map<number, { seller: CartRow["seller"]; rows: CartRow[] }>();
    for (const r of (rows ?? []) as CartRow[]) {
      const key = r.seller?.id ?? 0;
      if (!map.has(key)) map.set(key, { seller: r.seller, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const total = useMemo(
    () => ((rows ?? []) as CartRow[]).reduce((sum, r) => sum + lineInfo(r).unit * r.item.quantity, 0),
    [rows],
  );

  if (!loading && !isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <ShoppingCart className="w-12 h-12 mx-auto" style={{ color: "oklch(0.75 0.01 240)" }} />
        <p className="mt-4 font-bold text-lg">Sign in to see your cart</p>
        <a href="/login" className="btn-primary mt-4 inline-flex">Sign in</a>
      </div>
    );
  }

  if (loading || isLoading) {
    return (
      <div className="container py-8 space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const cartRows = (rows ?? []) as CartRow[];

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="container py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>
            Cart {cartRows.length > 0 && <span className="text-base font-bold" style={{ color: "oklch(0.52 0.015 240)" }}>({cartRows.length} items)</span>}
          </h1>
          {cartRows.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-red-600"
              disabled={clear.isPending} onClick={() => clear.mutate()}>
              <Trash2 className="w-4 h-4" />Clear cart
            </Button>
          )}
        </div>

        {cartRows.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">🛒</span>
            <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>Your cart is empty</p>
            <div className="flex gap-3 justify-center mt-4">
              <Link href="/shop" className="btn-primary">Browse Shop</Link>
              <Link href="/cards" className="btn-ghost">Browse Singles</Link>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* Items grouped by seller */}
            <div className="space-y-5">
              {groups.map((g, gi) => (
                <div key={g.seller?.id ?? gi} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2"
                    style={{ background: "oklch(0.985 0.003 240)" }}>
                    <Package className="w-4 h-4" style={{ color: "oklch(0.54 0.25 293)" }} />
                    <Link href={g.seller?.username ? `/profile/${g.seller.username}` : "#"}
                      className="font-bold text-sm hover:underline" style={{ color: "oklch(0.18 0.02 240)" }}>
                      {g.seller?.name ?? "Seller"}
                    </Link>
                    {g.seller?.sellerRating != null && (
                      <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>
                        <Star className="w-3 h-3" fill="#F59E0B" stroke="#F59E0B" />
                        {Number(g.seller.sellerRating).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {g.rows.map((r) => {
                    const info = lineInfo(r);
                    return (
                      <div key={r.item.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                        <Link href={info.href} className="w-12 h-16 rounded bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                          {info.img
                            ? <img src={info.img} alt="" loading="lazy" className="w-full h-full object-contain" />
                            : <Package className="w-5 h-5" style={{ color: "oklch(0.75 0.01 240)" }} />}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={info.href} className="font-bold text-sm line-clamp-1 hover:underline"
                            style={{ color: "oklch(0.18 0.02 240)" }}>{info.name}</Link>
                          <div className="flex items-center gap-2 mt-1">
                            {info.condition && <ConditionPill condition={info.condition} />}
                            {r.cardListing?.isFoil && <span className="badge badge-yellow text-[10px]">FOIL</span>}
                            <span className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>
                              ${info.unit.toFixed(2)} each · {info.stock} in stock
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button className="page-btn w-7 h-7 p-0 flex items-center justify-center"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ cartItemId: r.item.id, quantity: r.item.quantity - 1 })}>
                            {r.item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{r.item.quantity}</span>
                          <button className="page-btn w-7 h-7 p-0 flex items-center justify-center disabled:opacity-40"
                            disabled={update.isPending || r.item.quantity >= info.stock}
                            onClick={() => update.mutate({ cartItemId: r.item.id, quantity: r.item.quantity + 1 })}>
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-20 text-right font-black text-sm shrink-0" style={{ color: "oklch(0.18 0.02 240)" }}>
                          ${(info.unit * r.item.quantity).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-20">
              <h2 className="font-black text-lg mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>Summary</h2>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "oklch(0.52 0.015 240)" }}>Items</span>
                <span className="font-bold">{cartRows.reduce((s, r) => s + r.item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "oklch(0.52 0.015 240)" }}>Sellers</span>
                <span className="font-bold">{groups.length}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "oklch(0.52 0.015 240)" }}>Tracked US shipping</span>
                <span className="font-bold text-emerald-600">Included</span>
              </div>
              <div className="h-px my-3" style={{ background: "oklch(0.92 0.005 240)" }} />
              <div className="flex justify-between items-baseline mb-4">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>${total.toFixed(2)}</span>
              </div>

              <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000}
                placeholder="Note to sellers (optional) — delivery or packing details..."
                className="mb-3 text-sm" rows={3} />

              <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={value => setAcceptedTerms(value === true)}
                  className="mt-0.5"
                />
                <span>
                  I agree to the RarityGrid <Link href="/terms" className="font-bold text-violet-600 hover:underline">Marketplace Terms</Link>, including the condition, shipping and buyer-protection rules.
                </span>
              </label>

              {stripeAvailable.data && (
                <Button className="w-full gap-2 mb-2" size="lg"
                  style={{ background: "#635BFF" }}
                  disabled={stripeCheckout.isPending || !acceptedTerms}
                  onClick={() => stripeCheckout.mutate({
                    notes: notes.trim() || undefined,
                    acceptMarketplaceTerms: true,
                  })}>
                  <CreditCard size={16} />
                  {stripeCheckout.isPending ? "Reserving inventory…" : "Secure checkout"}
                </Button>
              )}
              {!stripeAvailable.isLoading && !stripeAvailable.data && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  Secure checkout is temporarily unavailable. Your cart has not been charged or reserved.
                </p>
              )}

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100 text-[10px] font-bold text-gray-400">
                <span className="inline-flex items-center gap-1"><LockKeyhole size={11} /> SSL encrypted</span>
                <span className="inline-flex items-center gap-1"><CreditCard size={11} /> Stripe secure</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck size={11} /> Buyer protection</span>
              </div>
              <p className="text-[11px] mt-3 leading-snug" style={{ color: "oklch(0.52 0.015 240)" }}>
                Inventory is reserved for 30 minutes while you pay. Stripe securely collects your card and shipping address; RarityGrid never stores card numbers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
