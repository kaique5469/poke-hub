import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bell, BellRing, Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { trpc } from "@/lib/trpc";
import { isNative } from "@/lib/native";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DROP_RETAILER_GROUPS,
  DROP_RETAILER_META,
  type DropRetailer,
} from "@shared/drops";
import { useT, useLocale } from "../i18n";
import { usePrefs } from "../prefs";
import { AppHeader } from "../components/AppHeader";
import { EmptyState, SignInCard } from "../components/SignInCard";
import { track } from "../analytics";
import { CommunityReports } from "../components/CommunityReports";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/**
 * Restock alerts, mobile edition: the watchlist, a two-field "new alert"
 * sheet (product + retailer, grouped Brazil / United States), push opt-in
 * and the latest detections. Release windows and companion tokens stay on
 * the website's /drops page.
 */
export default function AppAlerts() {
  const t = useT();
  const locale = useLocale();
  const { moneyIn } = usePrefs();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const status = trpc.dropMonitor.status.useQuery(undefined, { enabled: isAuthenticated });
  const monitors = trpc.dropMonitor.list.useQuery(undefined, { enabled: isAuthenticated });
  const recent = trpc.dropMonitor.recent.useQuery({ limit: 10 }, { enabled: isAuthenticated });
  const create = trpc.dropMonitor.create.useMutation({
    onSuccess: () => {
      utils.dropMonitor.list.invalidate();
      toast.success(t("Watching"));
      track("alert_created");
    },
  });
  const update = trpc.dropMonitor.update.useMutation({
    onSuccess: () => utils.dropMonitor.list.invalidate(),
  });
  const removeMonitor = trpc.dropMonitor.delete.useMutation({
    onSuccess: () => utils.dropMonitor.list.invalidate(),
  });
  const subscribe = trpc.dropMonitor.push.subscribe.useMutation();

  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [retailer, setRetailer] = useState<DropRetailer>(
    locale === "pt-BR" ? "amazon_br" : "pokemon_center"
  );
  const [pushState, setPushState] = useState<"idle" | "on" | "busy">(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "on" : "idle"
  );

  const brGroup = DROP_RETAILER_GROUPS.find(g => g.label === "Brazil");
  const usGroups = DROP_RETAILER_GROUPS.filter(g => g.label !== "Brazil");
  const dateFmt = new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function enablePush() {
    const key = status.data?.vapidPublicKey;
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error(t("Enable notifications"));
      return;
    }
    setPushState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("idle");
        return;
      }
      const reg = await navigator.serviceWorker.register("/drop-sw.js", { scope: "/" });
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await subscribe.mutateAsync({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      setPushState("on");
      track("push_enabled");
      toast.success(t("Notifications on"));
    } catch {
      setPushState("idle");
      toast.error(t("Retry"));
    }
  }

  if (!loading && !isAuthenticated) {
    return (
      <div className="app-page">
        <AppHeader title={t("Alerts")} subtitle={t("Get a push the moment a sealed product is back in stock.")} />
        <SignInCard
          title={t("Sign in to arm alerts")}
          body={t("Alerts need an account so we can reach you.")}
          next="/app/alerts"
        />
        <CommunityReports country={locale === "pt-BR" ? "BR" : "US"} />
      </div>
    );
  }

  const list = monitors.data ?? [];

  return (
    <div className="app-page">
      <AppHeader
        title={t("Alerts")}
        right={
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("New alert")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        }
      />

      {status.data && !status.data.providerConnected && (
        <p className="mb-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          {t("Live stock data is not connected yet; alerts arm and wait.")}
        </p>
      )}

      {isNative() ? (
        // WKWebView / Android WebView have no Web Push; native push comes
        // with the store build. Alerts still show in the app.
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          {t("Push notifications arrive with the store release; alerts show here in the meantime.")}
        </p>
      ) : (
        <button
          type="button"
          onClick={enablePush}
          disabled={pushState !== "idle"}
          className={`mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
            pushState === "on"
              ? "border-[var(--app-up)] text-[var(--app-up)]"
              : "border-border bg-secondary text-secondary-foreground"
          }`}
        >
          {pushState === "on" ? (
            <BellRing className="h-4 w-4" aria-hidden />
          ) : (
            <Bell className="h-4 w-4" aria-hidden />
          )}
          {pushState === "on" ? t("Notifications on") : t("Enable notifications")}
        </button>
      )}

      {list.length === 0 && !monitors.isLoading ? (
        <EmptyState
          title={t("No alerts yet")}
          body={t("Add a product you want and we tell you when it is back.")}
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground"
            >
              {t("New alert")}
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {list.map(m => {
            const meta = DROP_RETAILER_META[m.retailer as DropRetailer];
            return (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: m.isActive ? "var(--app-up)" : "var(--color-border)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.productName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {meta?.name ?? m.retailer}
                    {m.maxPriceCents
                      ? ` · ≤ ${moneyIn(m.maxPriceCents / 100, m.currency === "BRL" ? "BRL" : "USD")}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}
                  className="h-8 rounded-full border border-border px-3 text-xs font-semibold"
                >
                  {m.isActive ? t("Watching") : t("Retry")}
                </button>
                <button
                  type="button"
                  onClick={() => removeMonitor.mutate({ id: m.id })}
                  aria-label={t("Remove")}
                  className="h-8 px-2 text-xs text-[var(--app-down)]"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(recent.data?.length ?? 0) > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-base font-bold">{t("Recent drops")}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {recent.data!.map(e => (
              <li key={e.id}>
                <a
                  href={e.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {DROP_RETAILER_META[e.retailer as DropRetailer]?.name ?? e.retailer} ·{" "}
                      {dateFmt.format(new Date(e.detectedAt))}
                    </p>
                  </div>
                  {e.priceCents != null && (
                    <span className="text-sm font-bold">
                      {moneyIn(e.priceCents / 100, e.currency === "BRL" ? "BRL" : "USD")}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CommunityReports country={locale === "pt-BR" ? "BR" : "US"} />

      <Link href="/drops" className="mt-5 block text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
        {t("Manage all alerts on the website")}
      </Link>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="app-dark border-border bg-background">
          <form
            className="px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-2"
            onSubmit={e => {
              e.preventDefault();
              if (productName.trim().length < 2) return;
              create.mutate(
                { productName: productName.trim(), retailer, desiredQuantity: 1, monitorMode: "always" },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setProductName("");
                  },
                }
              );
            }}
          >
            <DrawerTitle className="text-lg font-extrabold">{t("New alert")}</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              {t("Get a push the moment a sealed product is back in stock.")}
            </DrawerDescription>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold">{t("Product name")}</span>
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="Elite Trainer Box…"
                className="h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base outline-none"
                required
                minLength={2}
              />
            </label>
            <label className="mt-4 block">
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
            <button
              type="submit"
              disabled={create.isPending}
              className="mt-6 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-60"
            >
              {t("Save")}
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
