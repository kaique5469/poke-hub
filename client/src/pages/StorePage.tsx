/**
 * Public store page — /store/:slug
 * Banner, badges, policies, active listings and seller reviews.
 */
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BadgeCheck,
  Clock,
  CreditCard,
  LockKeyhole,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";

const VIOLET = "#7C3AED";
const GOLD = "#F5B301";
const INK = "#0B1220";

const PAYMENT_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  card: { label: "Card (secure checkout)", icon: <CreditCard size={13} /> },
};

const CONDITION_LABELS: Record<string, string> = {
  M: "Mint", NM: "Near Mint", SP: "Slightly Played", MP: "Moderately Played", HP: "Heavily Played", D: "Damaged",
};

function Badge({ icon, label, color = VIOLET }: { icon: ReactNode; label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide rounded-full px-3 py-1"
      style={{ background: `${color}15`, color }}
    >
      {icon} {label}
    </span>
  );
}

export default function StorePage() {
  const [, params] = useRoute("/store/:slug");
  const slug = params?.slug ?? "";

  const storeQ = trpc.store.bySlug.useQuery({ slug }, { enabled: !!slug, retry: false });
  const data = storeQ.data;
  const reviewsQ = trpc.orders.sellerReviews.useQuery(
    { sellerId: data?.store.userId ?? 0, limit: 10 },
    { enabled: !!data },
  );

  if (storeQ.isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (storeQ.isError || !data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <Store size={40} className="text-gray-300" />
        <h1 className="text-xl font-black" style={{ color: INK }}>Store not found</h1>
        <Link href="/shop" className="text-sm font-bold text-violet-600 hover:underline">Browse the marketplace</Link>
      </div>
    );
  }

  const { store } = data;
  const rating = data.sellerRating ? parseFloat(String(data.sellerRating)) : 0;
  const payments = Array.isArray(store.paymentMethods) ? (store.paymentMethods as string[]) : [];
  const memberYear = data.memberSince ? new Date(data.memberSince).getFullYear() : null;
  const cards = data.listings.cards;
  const products = data.listings.products;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ── Banner ── */}
      <div
        className="h-40 md:h-52 relative"
        style={{
          background: store.bannerUrl
            ? `url(${store.bannerUrl}) center/cover`
            : `linear-gradient(120deg, ${INK} 0%, #312e81 60%, ${VIOLET} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* ── Store header ── */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm -mt-14 relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-black shrink-0 -mt-14 md:-mt-16 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${VIOLET}, #FF2E9A)` }}
            >
              {store.logoUrl
                ? <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" />
                : store.storeName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black" style={{ color: INK, fontFamily: "var(--font-display)" }}>
                  {store.storeName}
                </h1>
                {data.isVerifiedSeller && <Badge icon={<BadgeCheck size={12} />} label="Verified seller" color="#10B981" />}
                {data.hasPhysicalStore && <Badge icon={<Store size={12} />} label="Physical store" />}
                {store.status === "paused" && <Badge icon={<Clock size={12} />} label="On vacation" color="#F59E0B" />}
              </div>
              {store.tagline && <p className="text-sm text-gray-500 mt-1">{store.tagline}</p>}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Star size={14} fill={GOLD} style={{ color: GOLD }} />
                  {rating > 0 ? rating.toFixed(1) : "New"}
                  {reviewsQ.data && reviewsQ.data.length > 0 && (
                    <span className="text-gray-400 font-normal">({reviewsQ.data.length} reviews)</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1"><ShoppingBag size={14} /> {data.totalSales ?? 0} sales</span>
                {store.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {store.location}</span>}
                {memberYear && <span className="inline-flex items-center gap-1"><Clock size={14} /> Member since {memberYear}</span>}
              </div>
            </div>
          </div>

          {store.description && (
            <p className="text-sm text-gray-600 leading-relaxed mt-5 border-t border-gray-100 pt-5">{store.description}</p>
          )}
        </div>

        {/* ── Trust panel ── */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide mb-3" style={{ color: VIOLET }}>
              <CreditCard size={14} /> Accepted payments
            </div>
            <div className="flex flex-wrap gap-2">
              {payments.length > 0 ? payments.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-100 rounded-full px-3 py-1.5 text-gray-700">
                  {PAYMENT_LABELS[p]?.icon} {PAYMENT_LABELS[p]?.label ?? p}
                </span>
              )) : <span className="text-xs text-gray-400">Ask the seller</span>}
            </div>
            {payments.includes("card") && (
              <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
                <LockKeyhole size={11} /> Card payments protected by Stripe + buyer protection
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide mb-3" style={{ color: VIOLET }}>
              <Truck size={14} /> Shipping
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {store.shippingPolicy ?? "Contact the seller for shipping details."}
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              Ships in {store.handlingDays} {store.handlingDays === 1 ? "day" : "days"}
              {store.shipsFrom ? ` from ${store.shipsFrom}` : ""}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide mb-3" style={{ color: VIOLET }}>
              <ShieldCheck size={14} /> Returns
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {store.returnPolicy ?? "Contact the seller for return details."}
            </p>
          </div>
        </div>

        {/* ── Card listings ── */}
        <div className="mt-10">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2" style={{ color: INK, fontFamily: "var(--font-display)" }}>
            <Package size={18} style={{ color: VIOLET }} /> Singles for sale <span className="text-gray-400 font-bold text-sm">({cards.length})</span>
          </h2>
          {cards.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-400">
              No active card listings right now.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {cards.map((l) => (
                <Link key={l.id} href={`/cards/${l.cardId}`} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {l.imageUrl && (
                    <div className="bg-gray-100 aspect-[3/4] overflow-hidden">
                      <img src={l.imageUrl} alt={l.cardName} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="text-xs font-bold truncate" style={{ color: INK }}>{l.cardName}</div>
                    <div className="text-[10px] text-gray-400 truncate">{l.setName}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-bold bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">{CONDITION_LABELS[l.condition] ?? l.condition}</span>
                      <span className="text-sm font-black" style={{ color: VIOLET }}>${parseFloat(String(l.priceUsd)).toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Product listings ── */}
        {products.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2" style={{ color: INK, fontFamily: "var(--font-display)" }}>
              <ShoppingBag size={18} style={{ color: VIOLET }} /> Sealed products <span className="text-gray-400 font-bold text-sm">({products.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {products.map((p) => (
                <Link key={p.listing.id} href={p.productSlug ? `/shop/${p.productSlug}` : "/shop"} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  {p.productImageUrl && (
                    <div className="bg-gray-100 aspect-square overflow-hidden">
                      <img src={p.productImageUrl} alt={p.productName ?? ""} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="text-xs font-bold truncate" style={{ color: INK }}>{p.productName}</div>
                    <div className="text-sm font-black mt-1.5" style={{ color: VIOLET }}>${parseFloat(String(p.listing.priceUsd)).toFixed(2)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Reviews ── */}
        <div className="mt-10">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2" style={{ color: INK, fontFamily: "var(--font-display)" }}>
            <Star size={18} style={{ color: GOLD }} /> Seller reviews
          </h2>
          {!reviewsQ.data || reviewsQ.data.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-400">
              No reviews yet — be the first to buy from this store.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {reviewsQ.data.map((r) => (
                <div key={r.review.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-black text-gray-500">
                      {r.reviewerAvatarUrl
                        ? <img src={r.reviewerAvatarUrl} alt="" className="w-full h-full object-cover" />
                        : (r.reviewerName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold" style={{ color: INK }}>{r.reviewerName ?? r.reviewerUsername ?? "Buyer"}</span>
                    <span className="ml-auto inline-flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} fill={i < r.review.rating ? GOLD : "none"} style={{ color: i < r.review.rating ? GOLD : "#d1d5db" }} />
                      ))}
                    </span>
                  </div>
                  {r.review.comment && <p className="text-xs text-gray-600 leading-relaxed">{r.review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
