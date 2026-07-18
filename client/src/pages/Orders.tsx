import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Package,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConditionPill } from "@/components/ConditionPill";
import {
  ORDER_DISPUTE_REASONS,
  type OrderDisputeReason,
} from "@shared/marketplace";
import {
  getTrackingUrl,
  TRACKING_CARRIER_LABELS,
  TRACKING_CARRIERS,
  type TrackingCarrier,
} from "@shared/tracking";

type OrderStatus =
  "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "disputed";
type OrderActionStatus = "shipped" | "delivered" | "cancelled" | "disputed";

const STATUS_STYLE: Record<
  OrderStatus,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: "Pending", bg: "#FEF9C3", fg: "#854D0E" },
  paid: { label: "Paid", bg: "#DBEAFE", fg: "#1E40AF" },
  shipped: { label: "Shipped", bg: "#E0E7FF", fg: "#3730A3" },
  delivered: { label: "Delivered", bg: "#D1FAE5", fg: "#065F46" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", fg: "#4B5563" },
  disputed: { label: "Disputed", bg: "#FEE2E2", fg: "#991B1B" },
};

type PayoutStatus = "held" | "released" | "refunded";

interface OrderRow {
  order: {
    id: number;
    quantity: number;
    totalUsd: string;
    status: OrderStatus;
    payoutStatus?: PayoutStatus;
    autoReleaseAt?: string | Date | null;
    paymentStatus?: string;
    stripeSessionExpiresAt?: string | Date | null;
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingAddress?: {
      line1: string;
      line2?: string | null;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
    trackingCarrier?: TrackingCarrier | null;
    trackingNumber: string | null;
    notes: string | null;
    createdAt: string | Date;
    disputeReason?: OrderDisputeReason | null;
    disputeDetails?: string | null;
  };
  cardListing: {
    cardName: string;
    imageUrl: string | null;
    condition: string;
    cardId: string;
  } | null;
  productListing: { condition: string } | null;
  productName: string | null;
  productImageUrl: string | null;
  counterpartyName: string | null;
  counterpartyUsername: string | null;
  hasReview: boolean;
}

const DISPUTE_REASON_LABELS: Record<OrderDisputeReason, string> = {
  item_not_received: "Item not received",
  not_as_described: "Item not as described",
  suspected_counterfeit: "Suspected counterfeit",
  damaged_in_transit: "Damaged in transit",
  other: "Other problem",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

/** Escrow badge — shows where the money is. */
function PayoutBadge({
  payoutStatus,
  paid,
  role,
}: {
  payoutStatus?: PayoutStatus;
  paid: boolean;
  role: "buyer" | "seller";
}) {
  if (!paid || !payoutStatus) return null;
  const map: Record<PayoutStatus, { label: string; bg: string; fg: string }> = {
    held: {
      label: role === "buyer" ? "Payment protected" : "Payout held",
      bg: "#F3E8FF",
      fg: "#6B21A8",
    },
    released: {
      label: role === "buyer" ? "Completed" : "Payout sent",
      bg: "#D1FAE5",
      fg: "#065F46",
    },
    refunded: { label: "Refunded", bg: "#FEE2E2", fg: "#991B1B" },
  };
  const s = map[payoutStatus];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase"
      style={{ background: s.bg, color: s.fg }}
    >
      <ShieldCheck className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function ReviewDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const review = trpc.orders.review.useMutation({
    onSuccess: () => {
      toast.success("Review submitted!");
      utils.orders.myPurchases.invalidate();
      onClose();
      setRating(5);
      setComment("");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate this seller</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating(s)}>
                <Star
                  className="w-8 h-8"
                  fill={s <= rating ? "#F59E0B" : "none"}
                  stroke={s <= rating ? "#F59E0B" : "#D1D5DB"}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={2000}
            placeholder="How was the transaction? (optional)"
            rows={3}
          />
          <Button
            className="w-full"
            disabled={review.isPending || !orderId}
            onClick={() =>
              orderId &&
              review.mutate({
                orderId,
                rating,
                comment: comment.trim() || undefined,
              })
            }
          >
            {review.isPending ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<OrderDisputeReason>("item_not_received");
  const [details, setDetails] = useState("");
  const utils = trpc.useUtils();
  const dispute = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Dispute opened. The payment is now frozen for review.");
      utils.orders.myPurchases.invalidate();
      utils.orders.mySales.invalidate();
      setReason("item_not_received");
      setDetails("");
      onClose();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={value => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" /> Open a
            buyer-protection dispute
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Opening a dispute freezes the seller payout while the RarityGrid
            team reviews the order.
          </p>
          <label className="block space-y-1.5 text-sm font-bold">
            Problem
            <select
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 font-normal"
              value={reason}
              onChange={event =>
                setReason(event.target.value as OrderDisputeReason)
              }
            >
              {ORDER_DISPUTE_REASONS.map(value => (
                <option key={value} value={value}>
                  {DISPUTE_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm font-bold">
            What happened?
            <Textarea
              value={details}
              onChange={event => setDetails(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Include dates, package condition and any other useful details."
            />
            <span className="block text-right text-xs font-normal text-gray-400">
              {details.trim().length}/2000 · minimum 10 characters
            </span>
          </label>
          <Button
            variant="destructive"
            className="w-full"
            disabled={
              !orderId || details.trim().length < 10 || dispute.isPending
            }
            onClick={() =>
              orderId &&
              dispute.mutate({
                orderId,
                status: "disputed",
                disputeReason: reason,
                disputeDetails: details.trim(),
              })
            }
          >
            {dispute.isPending
              ? "Opening dispute…"
              : "Open dispute and freeze payout"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderCard({
  row,
  role,
  onReview,
  onDispute,
}: {
  row: OrderRow;
  role: "buyer" | "seller";
  onReview: (orderId: number) => void;
  onDispute: (orderId: number) => void;
}) {
  const [tracking, setTracking] = useState("");
  const [trackingCarrier, setTrackingCarrier] =
    useState<TrackingCarrier>("usps");
  const [showShip, setShowShip] = useState(false);
  const utils = trpc.useUtils();

  const update = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order updated");
      utils.orders.myPurchases.invalidate();
      utils.orders.mySales.invalidate();
      setShowShip(false);
    },
    onError: e => toast.error(e.message),
  });

  const confirmReceipt = trpc.orders.confirmReceipt.useMutation({
    onSuccess: r => {
      toast.success(
        r.released ? "Payment released to seller. Thanks!" : "Receipt confirmed"
      );
      utils.orders.myPurchases.invalidate();
      utils.orders.mySales.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const o = row.order;
  const name = row.cardListing?.cardName ?? row.productName ?? "Item";
  const img = row.cardListing?.imageUrl ?? row.productImageUrl;
  const condition = row.cardListing?.condition ?? row.productListing?.condition;
  const trackingUrl = getTrackingUrl(o.trackingCarrier, o.trackingNumber);
  const setStatus = (
    status: OrderActionStatus,
    options?: { trackingNumber?: string; trackingCarrier?: TrackingCarrier }
  ) => update.mutate({ orderId: o.id, status, ...options });

  const actions: React.ReactNode[] = [];
  if (role === "seller") {
    if (o.status === "paid") {
      actions.push(
        <Button
          key="ship"
          size="sm"
          disabled={update.isPending}
          onClick={() => setShowShip(v => !v)}
          className="gap-1.5"
        >
          <Truck className="w-4 h-4" />
          Mark shipped
        </Button>,
        <Button
          key="cancel"
          size="sm"
          variant="ghost"
          className="text-red-600"
          disabled={update.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Cancel this paid order and refund the buyer? This cannot be undone."
              )
            ) {
              setStatus("cancelled");
            }
          }}
        >
          Cancel & refund
        </Button>
      );
    }
  } else {
    if (o.status === "pending" && o.paymentStatus !== "processing") {
      actions.push(
        <Button
          key="cancel"
          size="sm"
          variant="ghost"
          className="text-red-600"
          disabled={update.isPending}
          onClick={() => setStatus("cancelled")}
        >
          Cancel order
        </Button>
      );
    }
    if (o.status === "shipped") {
      actions.push(
        <Button
          key="delivered"
          size="sm"
          disabled={update.isPending}
          onClick={() => setStatus("delivered")}
        >
          Confirm delivery
        </Button>
      );
    }
    if (o.status === "paid" || o.status === "shipped") {
      actions.push(
        <Button
          key="dispute"
          size="sm"
          variant="ghost"
          className="text-red-600"
          disabled={update.isPending}
          onClick={() => onDispute(o.id)}
        >
          Open dispute
        </Button>
      );
    }
    if (o.status === "delivered") {
      if (o.payoutStatus === "held") {
        actions.push(
          <Button
            key="confirm"
            size="sm"
            disabled={confirmReceipt.isPending}
            className="gap-1.5"
            onClick={() => confirmReceipt.mutate({ orderId: o.id })}
          >
            <CheckCircle2 className="w-4 h-4" />
            {confirmReceipt.isPending
              ? "Releasing…"
              : "Confirm receipt & release payment"}
          </Button>,
          <Button
            key="dispute"
            size="sm"
            variant="ghost"
            className="text-red-600"
            disabled={update.isPending}
            onClick={() => onDispute(o.id)}
          >
            Report a problem
          </Button>
        );
      }
      if (!row.hasReview)
        actions.push(
          <Button
            key="review"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onReview(o.id)}
          >
            <Star className="w-4 h-4" />
            Rate seller
          </Button>
        );
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-12 h-16 rounded bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
          {img ? (
            <img
              src={img}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain"
            />
          ) : (
            <Package
              className="w-5 h-5"
              style={{ color: "oklch(0.75 0.01 240)" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-bold text-sm"
              style={{ color: "oklch(0.18 0.02 240)" }}
            >
              {name}
            </span>
            {condition && <ConditionPill condition={condition} />}
            <span
              className="text-xs"
              style={{ color: "oklch(0.52 0.015 240)" }}
            >
              ×{o.quantity}
            </span>
          </div>
          <div
            className="flex items-center gap-2 text-xs mt-1 flex-wrap"
            style={{ color: "oklch(0.52 0.015 240)" }}
          >
            <span>#{o.id}</span>
            <span>· {new Date(o.createdAt).toLocaleDateString()}</span>
            <span>
              · {role === "buyer" ? "Seller" : "Buyer"}:{" "}
              <Link
                href={
                  row.counterpartyUsername
                    ? `/profile/${row.counterpartyUsername}`
                    : "#"
                }
                className="font-semibold hover:underline"
              >
                {row.counterpartyName ?? "User"}
              </Link>
            </span>
            {o.trackingNumber &&
              (trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"
                >
                  ·{" "}
                  {o.trackingCarrier
                    ? TRACKING_CARRIER_LABELS[o.trackingCarrier]
                    : "Tracking"}
                  : {o.trackingNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>
                  · Tracking: <b>{o.trackingNumber}</b>
                </span>
              ))}
          </div>
          {o.notes && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: "oklch(0.52 0.015 240)" }}
            >
              “{o.notes}”
            </p>
          )}
          {o.status === "pending" && o.paymentStatus === "processing" && (
            <p className="text-xs mt-1 font-semibold text-amber-700">
              Secure payment in progress
              {o.stripeSessionExpiresAt &&
                ` · reservation expires ${new Date(o.stripeSessionExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              .
            </p>
          )}
          {o.payoutStatus === "held" &&
            (o.status === "shipped" || o.status === "delivered") && (
              <p
                className="text-xs mt-1 flex items-center gap-1"
                style={{ color: "#6B21A8" }}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                {role === "buyer"
                  ? o.status === "delivered"
                    ? "Confirm receipt to release payment to the seller."
                    : "Your payment is held safely until you confirm delivery."
                  : "Payout is held until the buyer confirms receipt."}
                {o.autoReleaseAt && (
                  <span>
                    {" "}
                    Auto-releases{" "}
                    {new Date(o.autoReleaseAt).toLocaleDateString()}.
                  </span>
                )}
              </p>
            )}
          {o.status === "disputed" && o.disputeReason && (
            <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-800">
              <b>{DISPUTE_REASON_LABELS[o.disputeReason]}</b>
              {o.disputeDetails ? ` — ${o.disputeDetails}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          <PayoutBadge
            payoutStatus={o.payoutStatus}
            paid={o.status !== "pending" && o.status !== "cancelled"}
            role={role}
          />
          <StatusBadge status={o.status} />
          <span
            className="font-black"
            style={{ color: "oklch(0.18 0.02 240)" }}
          >
            ${Number(o.totalUsd).toFixed(2)}
          </span>
        </div>
      </div>

      {o.shippingAddress && o.status !== "pending" && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <p className="mb-1 font-black uppercase tracking-wide text-gray-500">
            {role === "seller" ? "Ship to" : "Delivery address"}
          </p>
          <p className="font-bold">{o.shippingName}</p>
          <p>
            {o.shippingAddress.line1}
            {o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}
          </p>
          <p>
            {o.shippingAddress.city}, {o.shippingAddress.state}{" "}
            {o.shippingAddress.postalCode}
          </p>
          {o.shippingPhone && <p className="mt-1">Phone: {o.shippingPhone}</p>}
        </div>
      )}

      {(actions.length > 0 || showShip) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          {showShip && (
            <div className="flex items-center gap-2 flex-1 min-w-[280px] flex-wrap sm:flex-nowrap">
              <select
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm"
                value={trackingCarrier}
                onChange={event =>
                  setTrackingCarrier(event.target.value as TrackingCarrier)
                }
              >
                {TRACKING_CARRIERS.map(carrier => (
                  <option key={carrier} value={carrier}>
                    {TRACKING_CARRIER_LABELS[carrier]}
                  </option>
                ))}
              </select>
              <Input
                value={tracking}
                onChange={e => setTracking(e.target.value)}
                placeholder="Tracking number (required)"
                className="h-8 text-sm"
                maxLength={256}
              />
              <Button
                size="sm"
                disabled={update.isPending || tracking.trim().length < 4}
                onClick={() =>
                  setStatus("shipped", {
                    trackingNumber: tracking.trim(),
                    trackingCarrier,
                  })
                }
              >
                Confirm
              </Button>
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
  const [disputeOrderId, setDisputeOrderId] = useState<number | null>(null);

  const purchases = trpc.orders.myPurchases.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const sales = trpc.orders.mySales.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!loading && !isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <Package
          className="w-12 h-12 mx-auto"
          style={{ color: "oklch(0.75 0.01 240)" }}
        />
        <p className="mt-4 font-bold text-lg">Sign in to see your orders</p>
        <a href="/login" className="btn-primary mt-4 inline-flex">
          Sign in
        </a>
      </div>
    );
  }

  const active = tab === "purchases" ? purchases : sales;
  const list = (active.data ?? []) as unknown as OrderRow[];

  return (
    <div
      className="min-h-screen"
      style={{ background: "oklch(0.97 0.005 240)" }}
    >
      <div className="container py-8">
        <h1
          className="text-2xl font-black mb-4"
          style={{ color: "oklch(0.18 0.02 240)" }}
        >
          My Orders
        </h1>

        <div className="tab-list">
          <button
            onClick={() => setTab("purchases")}
            className={cn("tab-item", tab === "purchases" && "active")}
          >
            Purchases {purchases.data ? `(${purchases.data.length})` : ""}
          </button>
          <button
            onClick={() => setTab("sales")}
            className={cn("tab-item", tab === "sales" && "active")}
          >
            Sales {sales.data ? `(${sales.data.length})` : ""}
          </button>
        </div>

        {active.isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl">📭</span>
            <p
              className="mt-4 font-bold text-lg"
              style={{ color: "oklch(0.35 0.02 240)" }}
            >
              No {tab === "purchases" ? "purchases" : "sales"} yet
            </p>
            <Link href="/shop" className="btn-primary mt-4 inline-flex">
              Browse Shop
            </Link>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {list.map(row => (
              <OrderCard
                key={row.order.id}
                row={row}
                role={tab === "purchases" ? "buyer" : "seller"}
                onReview={setReviewOrderId}
                onDispute={setDisputeOrderId}
              />
            ))}
          </div>
        )}
      </div>

      <ReviewDialog
        orderId={reviewOrderId}
        open={reviewOrderId !== null}
        onClose={() => setReviewOrderId(null)}
      />
      <DisputeDialog
        orderId={disputeOrderId}
        open={disputeOrderId !== null}
        onClose={() => setDisputeOrderId(null)}
      />
    </div>
  );
}
