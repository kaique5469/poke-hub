import { useState } from "react";
import { toast } from "sonner";
import { MapPin, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DROP_RETAILER_GROUPS,
  DROP_RETAILER_META,
  dropRetailerCurrency,
  type DropRetailer,
} from "@shared/drops";
import { useLocale, useT } from "../i18n";
import { usePrefs } from "../prefs";
import { track } from "../analytics";

type StockState = "in_stock" | "low" | "out_of_stock";

function timeAgo(date: Date, t: (s: string) => string) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} ${t("min")} ${t("ago")}`;
  return `${Math.round(minutes / 60)} ${t("h")} ${t("ago")}`;
}

/**
 * The community layer of restock alerts: anyone signed in can report a
 * sighting; everyone sees the last 24 h and votes it up or down; people
 * with a matching monitor are pushed. Works with no stock provider.
 */
export function CommunityReports({ country }: { country: "BR" | "US" }) {
  const t = useT();
  const locale = useLocale();
  const { moneyIn } = usePrefs();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const reports = trpc.dropMonitor.reports.list.useQuery(
    { country, limit: 30 },
    { staleTime: 60_000 }
  );
  const vote = trpc.dropMonitor.reports.vote.useMutation({
    onSuccess: () => utils.dropMonitor.reports.list.invalidate(),
  });
  const [open, setOpen] = useState(false);

  function onVote(id: number, v: "confirm" | "dispute") {
    if (!isAuthenticated) {
      window.location.href = `/login?next=${encodeURIComponent("/app/alerts")}`;
      return;
    }
    vote.mutate({ id, vote: v });
    track("report_voted", { vote: v });
  }

  const list = reports.data ?? [];

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold">{t("Community sightings")}</h2>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              window.location.href = `/login?next=${encodeURIComponent("/app/alerts")}`;
              return;
            }
            setOpen(true);
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--app-gold)] px-3 text-xs font-extrabold text-black"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {t("Found it in stock")}
        </button>
      </div>

      {list.length === 0 && !reports.isLoading ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {t("No sightings yet. Be the first to report a restock.")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {list.map(r => {
            const meta = DROP_RETAILER_META[r.retailer as DropRetailer];
            const where = [r.storeName, r.city].filter(Boolean).join(" · ");
            const state = r.stockState as StockState;
            return (
              <li key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.productName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {meta?.name ?? r.retailer}
                      {where ? ` · ${where}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <span
                        className={
                          state === "in_stock"
                            ? "app-up"
                            : state === "low"
                              ? "app-gold"
                              : "app-down"
                        }
                      >
                        {state === "in_stock"
                          ? t("In stock")
                          : state === "low"
                            ? t("Few left")
                            : t("Sold out")}
                      </span>
                      {" · "}
                      {timeAgo(new Date(r.createdAt), t)}
                      {r.reporter ? ` · ${t("by")} ${r.reporter}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.priceCents != null && (
                      <p className="text-sm font-bold">
                        {moneyIn(r.priceCents / 100, r.currency === "BRL" ? "BRL" : "USD")}
                      </p>
                    )}
                    {r.productUrl && (
                      <a
                        href={r.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {t("Open website")}
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onVote(r.id, "confirm")}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {t("Confirm")}
                    {r.confirmations > 0 && <span className="app-up">{r.confirmations}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => onVote(r.id, "dispute")}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden /> {t("Not there")}
                    {r.disputes > 0 && <span className="app-down">{r.disputes}</span>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReportSheet open={open} onOpenChange={setOpen} defaultCountry={country} locale={locale} />
    </section>
  );
}

function ReportSheet({
  open,
  onOpenChange,
  defaultCountry,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCountry: "BR" | "US";
  locale: string;
}) {
  const t = useT();
  const utils = trpc.useUtils();
  const create = trpc.dropMonitor.reports.create.useMutation();
  const [retailer, setRetailer] = useState<DropRetailer>(
    defaultCountry === "BR" ? "amazon_br" : "target"
  );
  const [productName, setProductName] = useState("");
  const [where, setWhere] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [state, setState] = useState<StockState>("in_stock");

  const brGroup = DROP_RETAILER_GROUPS.find(g => g.label === "Brazil");
  const usGroups = DROP_RETAILER_GROUPS.filter(g => g.label !== "Brazil");
  const currency = dropRetailerCurrency(retailer);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    try {
      const result = await create.mutateAsync({
        retailer,
        productName: productName.trim(),
        storeName: where.trim() || undefined,
        productUrl: link.trim() || undefined,
        priceCents: Number.isFinite(cents) && cents > 0 ? cents : undefined,
        stockState: state,
      });
      track("report_created", { retailer, state, notified: result.notified });
      toast.success(
        result.notified > 0
          ? `${t("Report sent")} · ${t("{n} people notified", { n: result.notified })}`
          : t("Report sent")
      );
      utils.dropMonitor.reports.list.invalidate();
      setProductName("");
      setWhere("");
      setPrice("");
      setLink("");
      onOpenChange(false);
    } catch (error) {
      toast.error(t((error as Error).message || "Retry"));
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="app-dark max-h-[92vh] border-border bg-background">
        <form onSubmit={submit} className="overflow-y-auto px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-2">
          <DrawerTitle className="text-lg font-extrabold">{t("Found it in stock")}</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {t("Report what you saw and everyone watching that product gets a push.")}
          </DrawerDescription>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold">{t("Product name")}</span>
            <input
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="Elite Trainer Box…"
              required
              minLength={2}
              className="h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-bold">{t("Retailer")}</span>
            <select
              value={retailer}
              onChange={e => setRetailer(e.target.value as DropRetailer)}
              className="h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base"
            >
              {brGroup && (
                <optgroup label={t("Brazil")}>
                  {brGroup.retailers.map(r => (
                    <option key={r} value={r}>
                      {DROP_RETAILER_META[r].name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t("United States")}>
                {usGroups.flatMap(g => g.retailers).map(r => (
                  <option key={r} value={r}>
                    {DROP_RETAILER_META[r].name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["in_stock", "low", "out_of_stock"] as StockState[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                aria-pressed={state === s}
                className={`h-11 rounded-xl border text-sm font-semibold ${
                  state === s ? "border-primary bg-primary/15" : "border-border bg-secondary"
                }`}
              >
                {s === "in_stock" ? t("In stock") : s === "low" ? t("Few left") : t("Sold out")}
              </button>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-bold">{t("Store or city (optional)")}</span>
            <input
              value={where}
              onChange={e => setWhere(e.target.value)}
              placeholder={locale === "pt-BR" ? "Shopping Ibirapuera, São Paulo" : "Target, Newark NJ"}
              className="h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base outline-none"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{t("Price (optional)")}</span>
              <div className="flex h-12 items-center rounded-xl border border-border bg-secondary px-3">
                <span className="mr-2 text-sm text-muted-foreground">
                  {currency === "BRL" ? "R$" : "US$"}
                </span>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent text-base outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{t("Link (optional)")}</span>
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://"
                className="h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={create.isPending}
            className="mt-5 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? t("Loading…") : t("Send report")}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
