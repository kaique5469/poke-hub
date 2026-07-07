import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Package, Star, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConditionPill } from "@/components/ConditionPill";

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "disputed";

const STATUS_STYLE: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: "#FEF9C3", fg: "#854D0E" },
  paid: { label: "Paid", bg: "#DBEAFE", fg: "#1E40AF" },
  shipped: { label: "Shipped", bg: "#E0E7FF", fg: "#3730A3" },
  delivered: { label: "Delivered", bg: "#D1FAE5", fg: "#065F46" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", fg: "#4B5563" },
  disputed: { label: "Disputed", bg: "#FEE2E2", fg: "#991B1B" },
};

interface OrderRow {
  order: {
    id: number; quantity: number; totalUsd: string; status: OrderStatus;
    trackingNumber: string | null; notes: string | null; createdAt: string | Date;
  };
  cardListing: { cardName: string; imageUrl: string | null; condition: string; cardId: string } | null;
  productListing: { condition: string } | null;
  productName: string | null;
  productImageUrl: string | null;
  counterpartyName: string | null;
  counterpartyUsername: string | null;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase"
      style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  );
}

function ReviewDialog({ orderId, open, onClose }: { orderId: number | null; open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const review = trpc.orders.review.useMutation({
    onSuccess: () => {
      toast.success("Review submitted!");
      utils.orders.myPurchases.invalidate();
      onClose();
      setRating(5); setComment("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate this seller</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)}>
                <Star className="w-8 h-8" fill={s <= rating ? "#F59E0B" : "none"}
                  stroke={s <= rating ? "#F59E0B" : "#D1D5DB"} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={2000}
            placeholder="How was the transaction? (optional)" rows={3} />
          <Button className="w-full" disabled={review.isPending || !orderId}
            onClick={() => orderId && review.mutate({ orderId, rating, comment: comment.trim() || undefined })}>
            {review.isPending ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({
  row, role, onReview,
}: { row: OrderRow; role: "buyer" | "seller"; onReview: (orderId: number) => void }) {
  const [tracking, setTracking] = useState("");
  const [showShip, setShowShip] = useState(false);
  const utils = trpc.useUtils();

  const update = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order updated");
      utils.orders.myPurchases.invalidate();
      utils.orders.mySales.invalidate();
      setShowShip(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const o = row.order;
  const name = row.cardListing?.cardName ?? row.productName ?? "Item";
  const img = row.cardListing?.imageUrl ?? row.productImageUrl;
  const condition = row.cardListing?.condition ?? row.productListing?.condition;
  const setStatus = (status: OrderStatus, trackingNumber?: string) =>
    update.mutate({ orderId: o.id, status: status as Exclude<OrderStatus, "pending">, trackingNumber });

  const actions: React.ReactNode[] = [];
  if (role === "seller") {
    if (o.status === "pending") {
      actions.push(
        <Button key="paid" size="sm" disabled={update.isPending} onClick={() => setStatus("paid")}>Mark paid</Button>,
        <Button key="cancel" size="sm" variant="ghost" className="text-red-600" disabled={update.isPending} onClick={() => setStatus("cancelled")}>Cancel</Button>,
      );
    }
    if (o.status === "paid") {
      actions.push(
        <Button key="ship" size="sm" disabled={update.isPending} onClick={() => setShowShip(v => !v)} className="gap-1.5">
          <Truck className="w-4 h-4" />Mark shipped
        </Button>,
        <Button key="cancel" size="sm" variant="ghost" className="text-red-600" disabled={update.isPending} onClick={() => setStatus("cancelled")}>Cancel</Button>,
      );
    }
  } else {
    if (o.status === "pending") {
      actions.push(<Button key="cancel" size="sm" variant="ghost" className="text-red-600" disabled={update.isPending} onClick={() => setStatus("cancelled")}>Cancel order</Button>);
    }
    if (o.status === "shipped") {
      actions.push(<Button key="delivered" size="sm" disabled={update.isPending} onClick={() => setStatus("delivered")}>Confirm delivery</Button>);
    }
    if (o.status === "paid" || o.status === "shipped") {
      actions.push(<Button key="dispute" size="sm" variant="ghost" className="text-red-600" disabled={update.isPending} onClick={() => setStatus("disputed")}>Open dispute</Button>);
    }
    if (o.status === "delivered") {
      actions.push(
        <Button key="review" size="sm" variant="outline" className="gap-1.5" onClick={() => onReview(o.id)}>
          <Star className="w-4 h-4" />Rate seller
        </Button>,
      );
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-12 h-16 rounded bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
          {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-contain" />
            : <Package className="w-5 h-5" style={{ color: "oklch(0.75 0.01 240)" }} />}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: "oklch(0.18 0.02 240)" }}>{name}</span>
            {condition && <ConditionPill condition={condition} />}
            <span className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>×{o.quantity}</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1 flex-wrap" style={{ color: "oklch(0.52 0.015 240)" }}>
            <span>#{o.id}</span>
            <span>· {new Date(o.createdAt).toLocaleDateString()}</span>
            <span>· {role === "buyer" ? "Seller" : "Buyer"}:{" "}
              <Link href={row.counterpartyUsername ? `/profile/${row.counterpartyUsername}` : "#"}
                className="font-semibold hover:underline">{row.counterpartyName ?? "User"}</Link>
            </span>
            {o.trackingNumber && <span>· Tracking: <b>{o.trackingNumber}</b></span>}
          </div>
          {o.notes && <p className="text-xs mt-1 line-clamp-2" style={{ color: "oklch(0.52 0.015 240)" }}>“{o.notes}”</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={o.status} />
          <span className="font-black" style={{ color: "oklch(0.18 0.02 240)" }}>${Number(o.totalUsd).toFixed(2)}</span>
        </div>
      </div>

      {(actions.length > 0 || showShip) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          {showShip && (
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Input value={tracking} onChange={e => setTracking(e.target.value)}
                placeholder="Tracking number (optional)" className="h-8 text-sm" maxLength={256} />
              <Button size="sm" disabled={update.isPending}
                onClick={() => setStatus("shipped", tracking.trim() || undefined)}>Confirm</Button>
            </div>
          )}
          {!showShip && actions}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);

  const purchases = trpc.orders.myPurchases.useQuery(undefined, { enabled: isAuthenticated });
  const sales = trpc.orders.mySales.useQuery(undefined, { enabled: isAuthenticated });

  if (!loading && !isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <Package className="w-12 h-12 mx-auto" style={{ color: "oklch(0.75 0.01 240)" }} />
        <p className="mt-4 font-bold text-lg">Sign in to see your orders</p>
        <a href="/login" className="btn-primary mt-4 inline-flex">Sign in</a>
      </div>
    );
  }

  const active = tab === "purchases" ? purchases : sales;
  const list = (active.data ?? []) as unknown as OrderRow[];

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="container py-8">
        <h1 className="text-2xl font-black mb-4" style={{ color: "oklch(0.18 0.02 240)" }}>My Orders</h1>

        <div className="tab-list">
          <button onClick={() => setTab("purchases")} className={cn("tab-item", tab === "purchases" && "active")}>
            Purchases {purchases.data ? `(${purchases.data.length})` : ""}
          </button>
          <button onClick={() => setTab("sales")} className={cn("tab-item", tab === "sales" && "active")}>
            Sales {sales.data ? `(${sales.data.length})` : ""}
          </button>
        </div>

        {active.isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">📭</span>
            <p className="mt-4 font-bold text-lg" style={{ color: "oklch(0.35 0.02 240)" }}>
              No {tab === "purchases" ? "purchases" : "sales"} yet
            </p>
            <Link href="/shop" className="btn-primary mt-4 inline-flex">Browse Shop</Link>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {list.map((row) => (
              <OrderCard key={row.order.id} row={row}
                role={tab === "purchases" ? "buyer" : "seller"}
                onReview={setReviewOrderId} />
            ))}
          </div>
        )}
      </div>

      <ReviewDialog orderId={reviewOrderId} open={reviewOrderId !== null} onClose={() => setReviewOrderId(null)} />
    </div>
  );
}
