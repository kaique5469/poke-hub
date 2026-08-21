import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  Loader2,
  PackageSearch,
  Plus,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DROP_RETAILER_META,
  DROP_RETAILER_GROUPS,
  dropRetailerCurrency,
  dropRetailerTimezone,
  type DropRetailer,
} from "../../../shared/drops";

const RETAILER_STYLES: Partial<Record<
  DropRetailer,
  { glow: string; surface: string; dot: string }
>> = {
  walmart: {
    glow: "from-sky-500/30 via-blue-500/10 to-transparent",
    surface: "border-sky-400/25 bg-sky-500/[.08]",
    dot: "bg-sky-400",
  },
  target: {
    glow: "from-red-500/30 via-rose-500/10 to-transparent",
    surface: "border-red-400/25 bg-red-500/[.08]",
    dot: "bg-red-400",
  },
  pokemon_center: {
    glow: "from-amber-400/30 via-yellow-500/10 to-transparent",
    surface: "border-amber-300/25 bg-amber-400/[.08]",
    dot: "bg-amber-300",
  },
  amazon: {
    glow: "from-orange-400/30 via-amber-500/10 to-transparent",
    surface: "border-orange-300/25 bg-orange-400/[.08]",
    dot: "bg-orange-300",
  },
};

const DEFAULT_RETAILER_STYLE = RETAILER_STYLES.amazon!;

function retailerStyle(retailer: DropRetailer) {
  return RETAILER_STYLES[retailer] ?? DEFAULT_RETAILER_STYLE;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function relativeTime(value: Date | string | null) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1_000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function minuteToTime(minute: number) {
  const hours = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minute % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function timeToMinute(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMoney(priceCents: number | null, currency: string) {
  if (priceCents === null) return "Price pending";
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}

function parseMoneyInput(value: string, currency: "USD" | "BRL") {
  let normalized = value.trim();
  if (currency === "BRL" && normalized.includes(",")) {
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  } else {
    normalized = normalized.replaceAll(",", "");
  }
  return Number(normalized);
}

function applicationServerKey(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export default function Drops() {
  const { isAuthenticated } = useAuth();
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [retailer, setRetailer] = useState<DropRetailer>("walmart");
  const [maxPrice, setMaxPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [monitorMode, setMonitorMode] = useState<"always" | "release_windows">(
    "release_windows"
  );
  const [showWindowForm, setShowWindowForm] = useState(false);
  const [windowRetailer, setWindowRetailer] =
    useState<DropRetailer>("walmart");
  const [windowDay, setWindowDay] = useState("3");
  const [windowStart, setWindowStart] = useState("20:55");
  const [windowEnd, setWindowEnd] = useState("21:15");
  const [browserAlerts, setBrowserAlerts] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const [backgroundPushEnabled, setBackgroundPushEnabled] = useState(false);
  const [shortcutToken, setShortcutToken] = useState<string | null>(null);
  const initializedEvents = useRef(false);
  const lastEventId = useRef(0);

  const status = trpc.dropMonitor.status.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });
  const monitors = trpc.dropMonitor.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });
  const windows = trpc.dropMonitor.windows.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const events = trpc.dropMonitor.recent.useQuery(
    { limit: 20 },
    {
      enabled: isAuthenticated,
      refetchInterval: status.data?.activeWindows.length ? 5_000 : 15_000,
    }
  );
  const companionTokens = trpc.dropMonitor.companion.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const activeMonitorCount = useMemo(
    () => monitors.data?.filter(monitor => monitor.isActive).length ?? 0,
    [monitors.data]
  );
  const newestEvent = events.data?.[0];
  const detectionLatency = newestEvent
    ? Math.max(
        0,
        Math.round(
          (new Date(newestEvent.detectedAt).getTime() -
            new Date(newestEvent.observedAt).getTime()) /
            1_000
        )
      )
    : null;
  const selectedCurrency = dropRetailerCurrency(retailer);

  useEffect(() => {
    const rows = events.data;
    if (!rows?.length) return;
    const newest = rows[0].id;
    if (!initializedEvents.current) {
      initializedEvents.current = true;
      lastEventId.current = newest;
      return;
    }
    if (
      browserAlerts &&
      !backgroundPushEnabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      rows
        .filter(event => event.id > lastEventId.current)
        .reverse()
        .forEach(event => {
          const notification = new Notification(`🚨 ${event.title}`, {
            body: `${DROP_RETAILER_META[event.retailer as DropRetailer]?.name ?? event.retailer} • ${formatMoney(event.priceCents, event.currency)}`,
            icon: event.imageUrl ?? "/favicon.svg",
            tag: `drop-${event.id}`,
          });
          notification.onclick = () => {
            window.open(event.productUrl, "_blank", "noopener,noreferrer");
            notification.close();
          };
        });
    }
    lastEventId.current = Math.max(lastEventId.current, newest);
  }, [backgroundPushEnabled, browserAlerts, events.data]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !status.data?.vapidPublicKey ||
      !("serviceWorker" in navigator)
    ) {
      setBackgroundPushEnabled(false);
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration("/")
      .then(registration => registration?.pushManager.getSubscription())
      .then(subscription => {
        if (!cancelled) setBackgroundPushEnabled(Boolean(subscription));
      })
      .catch(() => {
        if (!cancelled) setBackgroundPushEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, status.data?.vapidPublicKey]);

  const refresh = async () => {
    await Promise.all([
      status.refetch(),
      monitors.refetch(),
      windows.refetch(),
      events.refetch(),
    ]);
  };

  const createMonitor = trpc.dropMonitor.create.useMutation({
    onSuccess: async () => {
      toast.success("Monitor armed");
      setProductName("");
      setProductUrl("");
      setMaxPrice("");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const updateMonitor = trpc.dropMonitor.update.useMutation({
    onSuccess: () => refresh(),
    onError: error => toast.error(error.message),
  });
  const deleteMonitor = trpc.dropMonitor.delete.useMutation({
    onSuccess: () => refresh(),
    onError: error => toast.error(error.message),
  });
  const checkNow = trpc.dropMonitor.checkNow.useMutation({
    onSuccess: async result => {
      toast.success(
        result.events
          ? `${result.events} live drop${result.events === 1 ? "" : "s"} found`
          : "Check complete"
      );
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createWindow = trpc.dropMonitor.windows.create.useMutation({
    onSuccess: async () => {
      toast.success("Release window saved");
      setShowWindowForm(false);
      await windows.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const updateWindow = trpc.dropMonitor.windows.update.useMutation({
    onSuccess: () => windows.refetch(),
    onError: error => toast.error(error.message),
  });
  const deleteWindow = trpc.dropMonitor.windows.delete.useMutation({
    onSuccess: () => windows.refetch(),
    onError: error => toast.error(error.message),
  });
  const subscribePush = trpc.dropMonitor.push.subscribe.useMutation();
  const unsubscribePush = trpc.dropMonitor.push.unsubscribe.useMutation();
  const createCompanion = trpc.dropMonitor.companion.create.useMutation({
    onSuccess: async result => {
      setShortcutToken(result.token);
      let copied = false;
      if (navigator.clipboard) {
        copied = await navigator.clipboard
          .writeText(result.token)
          .then(() => true)
          .catch(() => false);
      }
      await companionTokens.refetch();
      toast.success(
        copied ? "Shortcut token created and copied" : "Shortcut token created"
      );
    },
    onError: error => toast.error(error.message),
  });
  const revokeCompanion = trpc.dropMonitor.companion.revoke.useMutation({
    onSuccess: () => companionTokens.refetch(),
    onError: error => toast.error(error.message),
  });

  const enableBrowserAlerts = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Browser notifications are not available on this device");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setBrowserAlerts(false);
      toast.error("Notification permission was not granted");
      return;
    }
    const vapidPublicKey = status.data?.vapidPublicKey;
    if (!vapidPublicKey) {
      setBrowserAlerts(true);
      toast.warning("Notifications work while this page is open; Web Push still needs VAPID setup");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setBrowserAlerts(false);
      toast.error("On iPhone, add RarityGrid to the Home Screen before enabling push alerts");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/drop-sw.js");
      const expectedKey = applicationServerKey(vapidPublicKey);
      let subscription = await registration.pushManager.getSubscription();
      const currentKey = subscription?.options.applicationServerKey
        ? new Uint8Array(subscription.options.applicationServerKey)
        : null;
      if (
        subscription &&
        currentKey &&
        (currentKey.length !== expectedKey.length ||
          currentKey.some((value, index) => value !== expectedKey[index]))
      ) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedKey,
        });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Browser returned an incomplete push subscription");
      }
      await subscribePush.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setBrowserAlerts(true);
      setBackgroundPushEnabled(true);
      toast.success("Background push alerts enabled");
    } catch (error) {
      setBrowserAlerts(false);
      toast.error(error instanceof Error ? error.message : "Could not enable push alerts");
    }
  };

  const disableBrowserAlerts = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePush.mutateAsync({ endpoint: subscription.endpoint });
          await subscription.unsubscribe();
        }
      }
      setBrowserAlerts(false);
      setBackgroundPushEnabled(false);
      toast.success("Drop notifications disabled on this device");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not disable notifications"
      );
    }
  };

  const submitMonitor = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPrice = maxPrice
      ? Math.round(parseMoneyInput(maxPrice, selectedCurrency) * 100)
      : undefined;
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 1)) {
      toast.error("Enter a valid maximum price");
      return;
    }
    createMonitor.mutate({
      productName: productName.trim(),
      retailer,
      productUrl: productUrl.trim() || undefined,
      maxPriceCents: parsedPrice,
      desiredQuantity: Number(quantity),
      monitorMode,
    });
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-[75vh] bg-[#070b15] px-4 py-20 text-white">
        <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-white/[.05] p-8 text-center shadow-2xl backdrop-blur-xl">
          <Radar className="mx-auto mb-5 h-14 w-14 text-violet-300" />
          <h1 className="font-display text-3xl font-black">Drop Monitor</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Sign in to arm fast release windows, price limits and instant handoff
            alerts for Pokémon products.
          </p>
          <Button
            className="mt-7 rounded-xl bg-violet-500 px-6 font-bold text-white hover:bg-violet-400"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Sign in free
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060913] pb-20 text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,.3),transparent_34%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,.2),transparent_30%)]" />
        <div className="container relative py-10 sm:py-14">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-violet-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                RarityGrid live intelligence
              </div>
              <h1 className="font-display text-4xl font-black tracking-tight sm:text-6xl">
                Catch the drop.
                <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
                  Before stock moves.
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Monitor major retailers, regional chains, marketplaces and TCG
                specialists continuously, then switch to a five-second burst
                around known launch windows. Alerts open the verified retailer
                page directly; checkout always stays under your control.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={browserAlerts ? disableBrowserAlerts : enableBrowserAlerts}
                className={cn(
                  "rounded-xl border-white/15 bg-white/[.06] text-white hover:bg-white/[.1] hover:text-white",
                  browserAlerts && "border-emerald-400/30 bg-emerald-400/10"
                )}
              >
                {browserAlerts ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-300" />
                ) : (
                  <BellRing className="mr-2 h-4 w-4" />
                )}
                {browserAlerts
                  ? backgroundPushEnabled
                    ? "Push alerts on"
                    : "Page alerts on"
                  : "Enable browser alerts"}
              </Button>
              <Button
                variant="outline"
                onClick={() => refresh()}
                className="rounded-xl border-white/15 bg-white/[.06] text-white hover:bg-white/[.1] hover:text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={status.data?.providerConnected ? Wifi : WifiOff}
              label="Inventory source"
              value={status.data?.providerConnected ? "Connected" : "Setup required"}
              tone={status.data?.providerConnected ? "emerald" : "amber"}
            />
            <Metric icon={Radar} label="Active monitors" value={String(activeMonitorCount)} tone="violet" />
            <Metric icon={Zap} label="Burst target" value={`${status.data?.defaultBurstIntervalSeconds ?? 5}s`} tone="sky" />
            <Metric
              icon={Gauge}
              label="Last detection latency"
              value={detectionLatency === null ? "No event yet" : `${detectionLatency}s`}
              tone="fuchsia"
            />
          </div>
        </div>
      </section>

      <div className="container mt-7 space-y-7">
        {!status.data?.providerConnected && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[.08] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="font-bold text-amber-100">Inventory provider required</p>
                <p className="mt-1 text-sm text-amber-50/70">
                  The monitor engine is ready, but direct retailer scraping is
                  intentionally disabled. Connect an authorized/licensed data
                  source to activate live checks.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-amber-300/20 px-3 py-1 text-xs font-bold text-amber-200">
              Safe by design
            </span>
          </div>
        )}

        <section className="rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
                Retailer coverage
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {DROP_RETAILER_GROUPS.reduce(
                  (total, group) => total + group.retailers.length,
                  0
                )}{" "}
                Pokémon TCG sources ready
              </h2>
            </div>
            <p className="max-w-xl text-xs leading-5 text-slate-500">
              A source becomes live only after the authorized inventory provider
              confirms coverage. RarityGrid never guesses stock from a stale page.
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {DROP_RETAILER_GROUPS.map(group => (
              <div
                key={group.label}
                className="rounded-2xl border border-white/[.08] bg-black/15 p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">
                  {group.label}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.retailers.map(retailerId => (
                    <span
                      key={retailerId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        status.data?.providerRetailers.includes(retailerId)
                          ? "border-emerald-300/20 bg-emerald-400/[.08] text-emerald-200"
                          : "border-white/10 bg-white/[.05] text-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          status.data?.providerRetailers.includes(retailerId)
                            ? "bg-emerald-300"
                            : "bg-slate-600"
                        )}
                      />
                      {DROP_RETAILER_META[retailerId].name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {(["walmart", "target", "pokemon_center"] as DropRetailer[]).map(retailerId => {
            const meta = DROP_RETAILER_META[retailerId];
            const style = retailerStyle(retailerId);
            const retailerWindows = windows.data?.filter(
              window => window.retailer === retailerId && window.isActive
            );
            return (
              <div key={retailerId} className={cn("group relative overflow-hidden rounded-2xl border p-5", style.surface)}>
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity group-hover:opacity-100", style.glow)} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn("h-3 w-3 rounded-full shadow-lg", style.dot)} />
                      <p className="text-lg font-black">{meta.name}</p>
                    </div>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/70">
                      {retailerWindows?.length ?? 0} window{(retailerWindows?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-5 text-sm text-white/60">
                    {retailerWindows?.[0]
                      ? `${WEEKDAYS[retailerWindows[0].weekday]} ${minuteToTime(retailerWindows[0].startMinute)}–${minuteToTime(retailerWindows[0].endMinute)} ET`
                      : "Continuous monitoring only"}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-7 xl:grid-cols-[1.08fr_.92fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300">
                <PackageSearch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black">Arm a new monitor</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Paste an exact product URL for precision, or use a product name
                  to discover new listings automatically.
                </p>
              </div>
            </div>

            <form onSubmit={submitMonitor} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-name" className="text-slate-200">Product or search rule</Label>
                  <Input id="product-name" value={productName} onChange={event => setProductName(event.target.value)} placeholder="e.g. Ascended Heroes ETB" required minLength={2} className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-600" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-url" className="text-slate-200">Exact retailer URL <span className="text-slate-500">(optional)</span></Label>
                  <Input id="product-url" type="url" value={productUrl} onChange={event => setProductUrl(event.target.value)} placeholder={`https://www.${DROP_RETAILER_META[retailer].domain}/...`} className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-600" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Retailer</Label>
                  <Select value={retailer} onValueChange={value => setRetailer(value as DropRetailer)}>
                    <SelectTrigger className="h-12 rounded-xl border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <RetailerOptions />
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Monitoring mode</Label>
                  <Select value={monitorMode} onValueChange={value => setMonitorMode(value as "always" | "release_windows")}>
                    <SelectTrigger className="h-12 rounded-xl border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="release_windows">Release windows only</SelectItem>
                      <SelectItem value="always">Always + release bursts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-price" className="text-slate-200">Maximum price <span className="text-slate-500">{selectedCurrency}</span></Label>
                  <Input id="max-price" inputMode="decimal" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder={selectedCurrency === "BRL" ? "399,90" : "79.99"} className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-600" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Saved handoff quantity</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger className="h-12 rounded-xl border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex gap-3">
                  <Bot className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-200">Direct cart handoff</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Opens the verified product page. Automated cart or checkout
                      remains locked without retailer-approved delegated access.
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-slate-600/50 bg-slate-700/30 px-3 py-1 text-[10px] font-black uppercase text-slate-400">Approval required</span>
              </div>

              <Button type="submit" disabled={createMonitor.isPending || productName.trim().length < 2} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-fuchsia-500">
                {createMonitor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                Arm monitor
              </Button>
            </form>
          </div>

          <div className="space-y-7">
            <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 backdrop-blur sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black"><CalendarClock className="h-5 w-5 text-sky-300" /> Release windows</h2>
                  <p className="mt-1 text-sm text-slate-400">Times are explicit and editable. No guessed schedule is treated as permanent.</p>
                </div>
                <Button size="sm" onClick={() => setShowWindowForm(value => !value)} className="rounded-lg bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"><Plus className="mr-1 h-4 w-4" /> Add</Button>
              </div>

              {showWindowForm && (
                <div className="mt-5 grid gap-3 rounded-2xl border border-sky-300/15 bg-sky-500/[.06] p-4 sm:grid-cols-2">
                  <Select value={windowRetailer} onValueChange={value => setWindowRetailer(value as DropRetailer)}>
                    <SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <RetailerOptions />
                    </SelectContent>
                  </Select>
                  <Select value={windowDay} onValueChange={setWindowDay}>
                    <SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKDAYS.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="time" value={windowStart} onChange={event => setWindowStart(event.target.value)} className="border-white/10 bg-black/20 text-white" />
                  <Input type="time" value={windowEnd} onChange={event => setWindowEnd(event.target.value)} className="border-white/10 bg-black/20 text-white" />
                  <Button className="sm:col-span-2" disabled={createWindow.isPending} onClick={() => createWindow.mutate({ retailer: windowRetailer, label: `${WEEKDAYS[Number(windowDay)]} release watch`, timezone: dropRetailerTimezone(windowRetailer), weekday: Number(windowDay), startMinute: timeToMinute(windowStart), endMinute: timeToMinute(windowEnd), burstIntervalSeconds: 5, isActive: true })}>Save release window</Button>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {windows.isLoading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-slate-500" /> : windows.data?.length ? windows.data.map(window => (
                  <div key={window.id} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 transition-colors", window.isActive ? "border-white/10 bg-white/[.04]" : "border-white/5 bg-black/20 opacity-55")}>
                    <div className="rounded-xl bg-sky-400/10 p-2 text-sky-300"><Clock3 className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{DROP_RETAILER_META[window.retailer as DropRetailer]?.name} • {WEEKDAYS[window.weekday]}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{minuteToTime(window.startMinute)}–{minuteToTime(window.endMinute)} • {window.timezone} • {window.burstIntervalSeconds}s burst</p>
                    </div>
                    <Switch checked={window.isActive} onCheckedChange={isActive => updateWindow.mutate({ id: window.id, isActive })} />
                    <button aria-label="Delete release window" onClick={() => deleteWindow.mutate({ id: window.id })} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )) : <p className="py-6 text-center text-sm text-slate-500">No release windows configured.</p>}
              </div>
            </div>

            <div className="rounded-[28px] border border-violet-300/15 bg-gradient-to-br from-violet-500/[.12] to-fuchsia-500/[.04] p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-violet-300" />
                <div>
                  <h3 className="font-black">Fastest supported path</h3>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>1. Provider webhook detects the live listing.</li><li>2. RarityGrid deduplicates and alerts immediately.</li><li>3. Notification opens the verified product page.</li><li>4. You add/review the cart and complete checkout.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-black">
                    <Bot className="h-5 w-5 text-sky-300" /> iPhone Shortcut companion
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    A personal automation can check the newest verified event and
                    open its retailer URL. The token is shown once and expires in
                    90 days.
                  </p>
                </div>
                <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-sky-200">
                  iOS
                </span>
              </div>
              {shortcutToken ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[.07] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Copy now — it will not be shown again
                  </p>
                  <code className="mt-2 block break-all text-xs text-emerald-50/80">
                    {shortcutToken}
                  </code>
                  <Button
                    size="sm"
                    className="mt-3 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                    onClick={() => {
                      navigator.clipboard?.writeText(shortcutToken);
                      toast.success("Token copied");
                    }}
                  >
                    Copy token
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-4 w-full rounded-xl bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                  disabled={createCompanion.isPending}
                  onClick={() => createCompanion.mutate({ name: "iPhone Shortcut" })}
                >
                  {createCompanion.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Generate Shortcut access token
                </Button>
              )}
              <ol className="mt-4 space-y-1.5 text-xs leading-5 text-slate-500">
                <li>1. In Shortcuts, create a Time of Day personal automation.</li>
                <li>2. Add Get Contents of URL: https://raritygrid.com/api/drop-companion/next</li>
                <li>3. Add header Authorization: Bearer YOUR_TOKEN.</li>
                <li>4. If “available” is true, open “productUrl”.</li>
              </ol>
              {companionTokens.data?.filter(token => !token.revokedAt).map(token => (
                <div key={token.id} className="mt-3 flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400">
                  <span>{token.name} • expires {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "never"}</span>
                  <button
                    className="text-red-300 hover:text-red-200"
                    onClick={() => revokeCompanion.mutate({ id: token.id })}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-7 xl:grid-cols-[1.08fr_.92fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-emerald-300" /> Armed monitors</h2><p className="mt-1 text-sm text-slate-500">{activeMonitorCount} active • {monitors.data?.length ?? 0} total</p></div>
            </div>
            <div className="space-y-3">
              {monitors.isLoading ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-slate-500" /> : monitors.data?.length ? monitors.data.map(monitor => {
                const monitorRetailer = monitor.retailer as DropRetailer;
                const style = retailerStyle(monitorRetailer);
                return (
                  <article key={monitor.id} className={cn("rounded-2xl border p-4 transition-all", monitor.isActive ? "border-white/10 bg-black/15" : "border-white/5 bg-black/20 opacity-55")}>
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", style.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="max-w-full truncate font-bold">{monitor.productName}</h3><span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">{monitor.monitorMode === "release_windows" ? "window only" : "always"}</span></div>
                        <p className="mt-1 text-xs text-slate-500">{DROP_RETAILER_META[monitorRetailer]?.name ?? monitor.retailer} • {relativeTime(monitor.lastCheckedAt)}{monitor.lastPriceCents !== null ? ` • ${formatMoney(monitor.lastPriceCents, monitor.currency)}` : ""}</p>
                        {monitor.lastError && <p className="mt-2 line-clamp-1 text-xs text-amber-300/80">{monitor.lastError}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {monitor.productUrl && <a href={monitor.productUrl} target="_blank" rel="noopener noreferrer" aria-label="Open product" className="rounded-lg p-2 text-sky-300 transition-colors hover:bg-sky-500/10"><ExternalLink className="h-4 w-4" /></a>}
                        <button aria-label="Check monitor now" disabled={!status.data?.providerConnected || checkNow.isPending} onClick={() => checkNow.mutate({ id: monitor.id })} className="rounded-lg p-2 text-violet-300 transition-colors hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-30"><RefreshCw className={cn("h-4 w-4", checkNow.isPending && "animate-spin")} /></button>
                        <Switch checked={monitor.isActive} onCheckedChange={isActive => updateMonitor.mutate({ id: monitor.id, isActive })} />
                        <button aria-label="Delete monitor" onClick={() => deleteMonitor.mutate({ id: monitor.id })} className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center"><Bell className="mx-auto h-9 w-9 text-slate-700" /><p className="mt-3 font-bold text-slate-300">No monitor armed</p><p className="mt-1 text-sm text-slate-600">Create your first rule above.</p></div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-5 sm:p-7">
            <div className="mb-5"><h2 className="flex items-center gap-2 text-xl font-black"><Zap className="h-5 w-5 text-amber-300" /> Live drop feed</h2><p className="mt-1 text-sm text-slate-500">New products and restocks, newest first.</p></div>
            <div className="space-y-3">
              {events.isLoading ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-slate-500" /> : events.data?.length ? events.data.map(event => {
                const eventRetailer = event.retailer as DropRetailer;
                const style = retailerStyle(eventRetailer);
                return (
                  <article key={event.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                    <div className="flex gap-3">
                      {event.imageUrl ? <img src={event.imageUrl} alt="" className="h-16 w-14 shrink-0 rounded-lg bg-white object-contain p-1" /> : <div className={cn("h-16 w-14 shrink-0 rounded-lg border", style.surface)} />}
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", style.dot)} /><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{event.eventType.replace("_", " ")}</span></div><p className="mt-1 line-clamp-2 text-sm font-bold">{event.title}</p><p className="mt-1 text-xs text-slate-500">{formatMoney(event.priceCents, event.currency)} • {relativeTime(event.detectedAt)}</p></div>
                      <a href={event.productUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-emerald-400 px-3 text-xs font-black text-emerald-950 transition-transform hover:scale-[1.03]">Open <ExternalLink className="h-3.5 w-3.5" /></a>
                    </div>
                  </article>
                );
              }) : <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center"><Radar className="mx-auto h-9 w-9 text-slate-700" /><p className="mt-3 font-bold text-slate-300">Listening for drops</p><p className="mt-1 text-sm text-slate-600">The first verified event will appear here.</p></div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: "emerald" | "amber" | "violet" | "sky" | "fuchsia" }) {
  const tones = {
    emerald: "border-emerald-300/15 bg-emerald-400/[.07] text-emerald-300",
    amber: "border-amber-300/15 bg-amber-400/[.07] text-amber-300",
    violet: "border-violet-300/15 bg-violet-400/[.07] text-violet-300",
    sky: "border-sky-300/15 bg-sky-400/[.07] text-sky-300",
    fuchsia: "border-fuchsia-300/15 bg-fuchsia-400/[.07] text-fuchsia-300",
  };
  return <div className={cn("rounded-2xl border p-4 backdrop-blur", tones[tone])}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80"><Icon className="h-4 w-4" /> {label}</div><p className="mt-3 text-xl font-black text-white">{value}</p></div>;
}

function RetailerOptions() {
  return (
    <>
      {DROP_RETAILER_GROUPS.map((group, groupIndex) => (
        <SelectGroup key={group.label}>
          {groupIndex > 0 && <SelectSeparator />}
          <SelectLabel>{group.label}</SelectLabel>
          {group.retailers.map(retailerId => (
            <SelectItem key={retailerId} value={retailerId}>
              {DROP_RETAILER_META[retailerId].name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
