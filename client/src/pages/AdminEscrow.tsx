import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, Banknote, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString() : "—");

interface EscrowOrder {
  id: number;
  buyerId: number;
  sellerId: number;
  totalUsd: string;
  status: string;
  payoutStatus: string;
  deliveredAt?: string | Date | null;
  autoReleaseAt?: string | Date | null;
  createdAt: string | Date;
}

interface LedgerRow {
  id: number;
  orderId: number;
  sellerId: number;
  amountCents: number;
  stripeTransferId: string | null;
  status: string;
  createdAt: string | Date;
}

const LEDGER_STYLE: Record<string, { bg: string; fg: string }> = {
  sent: { bg: "#D1FAE5", fg: "#065F46" },
  pending: { bg: "#FEF9C3", fg: "#854D0E" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
  reversed: { bg: "#F3F4F6", fg: "#4B5563" },
};

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black uppercase"
      style={{ background: bg, color: fg }}>{text}</span>
  );
}

export default function AdminEscrow() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const overview = trpc.escrow.overview.useQuery(undefined, { enabled: isAuthenticated && isAdmin });

  const resolve = trpc.escrow.resolveDispute.useMutation({
    onSuccess: () => { toast.success("Dispute resolved"); utils.escrow.overview.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const release = trpc.escrow.release.useMutation({
    onSuccess: (r) => {
      toast.success(r.released ? "Payout released" : "Nothing to release for this order");
      utils.escrow.overview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!loading && (!isAuthenticated || !isAdmin)) {
    return (
      <div className="container py-20 text-center">
        <ShieldCheck className="w-12 h-12 mx-auto" style={{ color: "oklch(0.75 0.01 240)" }} />
        <p className="mt-4 font-bold text-lg">Admin access only</p>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="container py-8 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>Escrow — Admin</h1>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={overview.isFetching}
            onClick={() => overview.refetch()}>
            <RefreshCw className="w-4 h-4" />Refresh
          </Button>
        </div>

        {overview.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !data ? (
          <p className="text-sm text-gray-500">Could not load escrow data.</p>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-bold uppercase" style={{ color: "#6B21A8" }}>Held in escrow (seller share)</p>
                <p className="text-3xl font-black mt-1" style={{ color: "oklch(0.18 0.02 240)" }}>{money(data.totals.heldCents)}</p>
                <p className="text-xs text-gray-500 mt-1">{data.held.length} order(s) awaiting release</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-bold uppercase" style={{ color: "#065F46" }}>Released (payouts sent)</p>
                <p className="text-3xl font-black mt-1" style={{ color: "oklch(0.18 0.02 240)" }}>{money(data.totals.releasedCents)}</p>
                <p className="text-xs text-gray-500 mt-1">{data.ledger.filter((p: LedgerRow) => p.status === "sent").length} transfer(s)</p>
              </div>
            </div>

            {/* Disputed */}
            <section>
              <h2 className="font-black text-lg mb-3 flex items-center gap-2" style={{ color: "oklch(0.18 0.02 240)" }}>
                <AlertTriangle className="w-5 h-5 text-red-600" />Disputes ({data.disputed.length})
              </h2>
              {data.disputed.length === 0 ? (
                <p className="text-sm text-gray-500">No open disputes.</p>
              ) : (
                <div className="space-y-2">
                  {(data.disputed as EscrowOrder[]).map((o) => (
                    <div key={o.id} className="bg-white border border-red-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-bold text-sm">Order #{o.id} — ${Number(o.totalUsd).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">
                          Buyer #{o.buyerId} · Seller #{o.sellerId} · {fmtDate(o.createdAt)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ orderId: o.id, resolution: "refund_buyer" })}>
                        Refund buyer
                      </Button>
                      <Button size="sm" disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ orderId: o.id, resolution: "release_seller" })}>
                        Release to seller
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Held */}
            <section>
              <h2 className="font-black text-lg mb-3 flex items-center gap-2" style={{ color: "oklch(0.18 0.02 240)" }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "#6B21A8" }} />Held funds ({data.held.length})
              </h2>
              {data.held.length === 0 ? (
                <p className="text-sm text-gray-500">No funds currently held.</p>
              ) : (
                <div className="space-y-2">
                  {(data.held as EscrowOrder[]).map((o) => (
                    <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-bold text-sm">Order #{o.id} — ${Number(o.totalUsd).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">
                          Status: <b>{o.status}</b> · Buyer #{o.buyerId} · Seller #{o.sellerId}
                          {o.autoReleaseAt && <> · Auto-release: {fmtDate(o.autoReleaseAt)}</>}
                        </p>
                      </div>
                      {(o.status === "delivered" || o.status === "shipped") && (
                        <Button size="sm" variant="outline" className="gap-1.5" disabled={release.isPending}
                          onClick={() => release.mutate({ orderId: o.id })}>
                          <Banknote className="w-4 h-4" />Force release
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Ledger */}
            <section>
              <h2 className="font-black text-lg mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>
                Payout ledger ({data.ledger.length})
              </h2>
              {data.ledger.length === 0 ? (
                <p className="text-sm text-gray-500">No payouts yet.</p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                        <th className="p-3">Order</th>
                        <th className="p-3">Seller</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Transfer</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.ledger as LedgerRow[]).map((p) => {
                        const s = LEDGER_STYLE[p.status] ?? LEDGER_STYLE.pending;
                        return (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0">
                            <td className="p-3 font-bold">#{p.orderId}</td>
                            <td className="p-3">#{p.sellerId}</td>
                            <td className="p-3 font-black">{money(p.amountCents)}</td>
                            <td className="p-3"><Pill text={p.status} bg={s.bg} fg={s.fg} /></td>
                            <td className="p-3 text-xs text-gray-500 max-w-[160px] truncate">{p.stripeTransferId ?? "—"}</td>
                            <td className="p-3 text-xs text-gray-500">{fmtDate(p.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
