import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Package,
  ShoppingCart,
  Star,
  Store,
  Tag,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONDITIONS, ConditionPill } from "@/components/ConditionPill";
import { usePageMeta } from "@/hooks/usePageMeta";
import { formatMarketplaceMoney } from "@shared/marketplace";

function SellDialog({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("NM");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();
  const sellerStatus = trpc.store.connectStatus.useQuery(undefined, {
    enabled: open,
  });

  const create = trpc.products.createListing.useMutation({
    onSuccess: () => {
      toast.success("Listing published!");
      setOpen(false);
      setPrice("");
      setQuantity("1");
      setNotes("");
      utils.products.bySlug.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="w-4 h-4" />
          Sell yours
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell: {productName}</DialogTitle>
        </DialogHeader>
        {sellerStatus.data &&
        (!sellerStatus.data.payoutsEnabled ||
          !sellerStatus.data.termsAccepted) ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-center">
            <ShieldCheck className="mx-auto h-9 w-9 text-violet-600" />
            <p className="mt-3 font-black text-gray-900">
              {!sellerStatus.data.hasStore
                ? "Open your seller store first"
                : !sellerStatus.data.termsAccepted
                  ? "Accept the current seller terms"
                  : "Complete Stripe payout setup"}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Only verified sellers can publish inventory.
            </p>
            <Link
              href={!sellerStatus.data.hasStore ? "/open-store" : "/dashboard"}
            >
              <Button className="mt-4 w-full">Continue seller setup</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">
                  Preço de venda (BRL)
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Inclua o frete rastreado no Brasil no preço do anúncio.
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Condition</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={
                      condition === c ? "ring-2 ring-blue-500 rounded-full" : ""
                    }
                  >
                    <ConditionPill condition={c} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Sealed, ships in a box, etc."
                maxLength={1000}
              />
            </div>
            <Button
              className="w-full"
              disabled={create.isPending || !price || Number(price) <= 0}
              onClick={() =>
                create.mutate({
                  productId,
                  priceUsd: Number(price),
                  quantity: Math.max(1, Number(quantity) || 1),
                  condition,
                  notes: notes.trim() || undefined,
                })
              }
            >
              {create.isPending ? "Publishing…" : "Publish listing"}
            </Button>
          </div>
        )}
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
    { enabled: !!slug, retry: false }
  );
  usePageMeta(
    data?.product.name ?? "Product",
    data?.product.description ??
      "Pokémon TCG sealed product marketplace listing.",
    data?.product.imageUrl ?? undefined,
    {
      type: "product",
      structuredData: data
        ? {
            "@context": "https://schema.org",
            "@type": "Product",
            url: `https://raritygrid.com/shop/${slug}`,
            name: data.product.name,
            description:
              data.product.description ??
              "Pokémon TCG sealed product marketplace listing.",
            image: data.product.imageUrl || undefined,
            category: data.product.category,
            brand: { "@type": "Brand", name: "Pokémon" },
            offers: data.sellers.length
              ? {
                  "@type": "AggregateOffer",
                  priceCurrency: "BRL",
                  lowPrice: Math.min(
                    ...data.sellers.map(seller =>
                      Number(seller.listing.priceUsd)
                    )
                  ),
                  highPrice: Math.max(
                    ...data.sellers.map(seller =>
                      Number(seller.listing.priceUsd)
                    )
                  ),
                  offerCount: data.sellers.length,
                  availability: "https://schema.org/InStock",
                }
              : undefined,
          }
        : undefined,
    }
  );

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success("Added to cart");
      utils.cart.count.invalidate();
      utils.cart.get.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-[320px_1fr] gap-8">
          <Skeleton className="h-64 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-20 text-center">
        <Package className="mx-auto h-14 w-14 text-gray-300" />
        <p className="mt-4 font-bold text-lg">Product not found</p>
        <Link href="/shop" className="btn-primary mt-4 inline-flex">
          Back to Shop
        </Link>
      </div>
    );
  }

  const { product, sellers, related, retailerLinks } = data;
  const refPrice = product.avgPriceUsd ?? product.minPriceUsd;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <div className="border-b border-white/10 bg-[#0b1020] text-white">
        <div className="container py-8">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4"
            style={{ color: "#c4b5fd" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Shop
          </Link>

          <div className="grid gap-8 md:grid-cols-[360px_1fr] md:items-center">
            <div className="flex h-80 items-center justify-center rounded-3xl bg-white p-8 shadow-2xl">
              {!imgError && product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="max-h-full object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Package className="h-16 w-16 text-gray-300" />
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                {product.setName ?? product.category.replaceAll("_", " ")}
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
                {product.name}
              </h1>
              {product.description && (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  {product.description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Market reference
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {refPrice
                      ? `$${Number(refPrice).toFixed(2)}`
                      : "Unavailable"}
                  </p>
                </div>
                {product.minPriceUsd && product.maxPriceUsd && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Observed range
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      ${Number(product.minPriceUsd).toFixed(2)} – $
                      {Number(product.maxPriceUsd).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Product panel */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2
                className="font-black text-lg"
                style={{ color: "oklch(0.18 0.02 240)" }}
              >
                {sellers.length} {sellers.length === 1 ? "seller" : "sellers"}
              </h2>
              {isAuthenticated ? (
                <SellDialog productId={product.id} productName={product.name} />
              ) : (
                <a href="/login" className="btn-ghost text-sm">
                  Sign in to sell
                </a>
              )}
            </div>

            {sellers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <Store
                  className="w-10 h-10 mx-auto"
                  style={{ color: "oklch(0.75 0.01 240)" }}
                />
                <p
                  className="mt-3 font-bold"
                  style={{ color: "oklch(0.35 0.02 240)" }}
                >
                  No active listings yet
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "oklch(0.52 0.015 240)" }}
                >
                  Be the first to sell this product.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sellers.map(s => (
                  <div
                    key={s.listing.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={
                            s.sellerUsername
                              ? `/profile/${s.sellerUsername}`
                              : "#"
                          }
                          className="font-bold text-sm hover:underline"
                          style={{ color: "oklch(0.18 0.02 240)" }}
                        >
                          {s.sellerName ?? "Seller"}
                        </Link>
                        {s.sellerIsVerified && (
                          <BadgeCheck className="w-4 h-4 text-blue-500" />
                        )}
                        {s.sellerHasPhysicalStore && (
                          <Store
                            className="w-3.5 h-3.5"
                            style={{ color: "oklch(0.52 0.015 240)" }}
                          />
                        )}
                      </div>
                      <div
                        className="flex items-center gap-2 text-xs mt-0.5"
                        style={{ color: "oklch(0.52 0.015 240)" }}
                      >
                        {s.sellerRating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star
                              className="w-3 h-3"
                              fill="#F59E0B"
                              stroke="#F59E0B"
                            />
                            {Number(s.sellerRating).toFixed(1)}
                          </span>
                        )}
                        <span>{s.sellerTotalSales ?? 0} sales</span>
                        {s.sellerLocation && <span>· {s.sellerLocation}</span>}
                      </div>
                      {s.listing.notes && (
                        <p
                          className="text-xs mt-1 line-clamp-1"
                          style={{ color: "oklch(0.52 0.015 240)" }}
                        >
                          {s.listing.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ConditionPill condition={s.listing.condition} />
                      <span
                        className="text-xs"
                        style={{ color: "oklch(0.52 0.015 240)" }}
                      >
                        ×{s.listing.quantity}
                      </span>
                      <span
                        className="font-black text-lg"
                        style={{ color: "oklch(0.18 0.02 240)" }}
                      >
                        {formatMarketplaceMoney(s.listing.priceUsd)}
                      </span>
                      {isAuthenticated ? (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={addToCart.isPending}
                          onClick={() =>
                            addToCart.mutate({
                              productListingId: s.listing.id,
                              quantity: 1,
                            })
                          }
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add
                        </Button>
                      ) : (
                        <a href="/login" className="btn-primary text-sm">
                          Sign in
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <ExternalLink className="h-5 w-5 text-violet-700" />
              <h3 className="mt-3 font-black text-gray-900">
                Check trusted retailers
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                No community listing yet? Compare current availability directly
                with established stores and marketplaces.
              </p>
              <div className="mt-4 space-y-2">
                {retailerLinks.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-black text-violet-800 transition hover:border-violet-400"
                  >
                    <span>
                      {link.name}
                      {link.official ? (
                        <span className="ml-2 text-[9px] uppercase tracking-wider text-emerald-700">
                          Official
                        </span>
                      ) : null}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-4 text-gray-500">
                Availability and checkout are handled by the selected retailer.
                RarityGrid does not guarantee third-party stock or prices.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="mt-3 font-black text-gray-900">
                Buyer protection
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Payments are held securely and released according to the order
                status.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <Truck className="h-5 w-5 text-violet-600" />
              <h3 className="mt-3 font-black text-gray-900">
                Seller-by-seller shipping
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Review each listing's notes and seller profile before checkout.
              </p>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
                  Keep exploring
                </p>
                <h2 className="mt-1 text-2xl font-black text-gray-900">
                  Related products
                </h2>
              </div>
              <Link
                href={
                  product.setId
                    ? `/shop?set=${product.setId}`
                    : `/shop?cat=${product.category}`
                }
                className="text-sm font-black text-violet-700"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map(item => (
                <Link
                  key={item.id}
                  href={`/shop/${item.slug}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-violet-300"
                >
                  <div className="flex aspect-square items-center justify-center rounded-xl bg-gray-50 p-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-contain transition group-hover:scale-105"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-black text-gray-900">
                    {item.name}
                  </p>
                  <p className="mt-2 text-sm font-black text-emerald-700">
                    {item.avgPriceUsd || item.minPriceUsd
                      ? `$${Number(item.avgPriceUsd ?? item.minPriceUsd).toFixed(2)}`
                      : "Price unavailable"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
