import { Suspense, lazy, useEffect } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  Bell,
  Home as HomeIcon,
  LayoutGrid,
  PieChart,
  ScanLine,
} from "lucide-react";
import { PrefsProvider, usePrefs } from "./prefs";
import { ProProvider } from "./pro";
import { useT } from "./i18n";
import { useMergePending } from "./useMergePending";
import { identify, track } from "./analytics";
import { useAuth } from "@/_core/hooks/useAuth";
import { consumeAuthDeepLink, isNative } from "@/lib/native";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const AppHome = lazy(() => import("./pages/AppHome"));
const AppScan = lazy(() => import("./pages/AppScan"));
const AppCollection = lazy(() => import("./pages/AppCollection"));
const AppPortfolio = lazy(() => import("./pages/AppPortfolio"));
const AppAlerts = lazy(() => import("./pages/AppAlerts"));
const AppSettings = lazy(() => import("./pages/AppSettings"));

function PageSkeleton() {
  return (
    <div className="app-page space-y-4">
      <Skeleton className="h-7 w-40 bg-muted" />
      <Skeleton className="h-24 w-full rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[63/88] rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

type Tab = {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  match: (path: string) => boolean;
};

function TabBar() {
  const t = useT();
  const [location] = useLocation();
  const tabs: Tab[] = [
    { href: "/app", label: t("Home"), icon: HomeIcon, match: p => p === "/app" || p === "/app/" },
    { href: "/app/collection", label: t("Collection"), icon: LayoutGrid, match: p => p.startsWith("/app/collection") },
    { href: "/app/scan", label: t("Scan"), icon: ScanLine, match: p => p.startsWith("/app/scan") },
    { href: "/app/portfolio", label: t("Portfolio"), icon: PieChart, match: p => p.startsWith("/app/portfolio") },
    { href: "/app/alerts", label: t("Alerts"), icon: Bell, match: p => p.startsWith("/app/alerts") },
  ];
  return (
    <nav className="app-tabbar" aria-label={t("Home")}>
      <ul className="mx-auto grid h-[var(--app-tabbar-h)] max-w-lg grid-cols-5 items-end">
        {tabs.map(tab => {
          const active = tab.match(location);
          const Icon = tab.icon;
          // The raised scan button is the call to action everywhere except
          // on the scanner itself, where the capture button already is.
          const isScan = tab.href === "/app/scan" && !active;
          return (
            <li key={tab.href} className="flex justify-center">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={
                  isScan
                    ? "relative -top-4 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.66_0.21_293/0.45)] active:scale-95 transition-transform"
                    : `flex h-full w-full flex-col items-center justify-center gap-1 pb-2 text-[11px] font-medium transition-colors ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`
                }
              >
                <Icon
                  className={isScan ? "h-7 w-7" : "h-[22px] w-[22px]"}
                  strokeWidth={active || isScan ? 2.4 : 1.9}
                  aria-hidden
                />
                {isScan ? (
                  <span className="sr-only">{tab.label}</span>
                ) : (
                  <span>{tab.label}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ShellBody() {
  useMergePending();
  const [location] = useLocation();
  const { currency } = usePrefs();
  const utils = trpc.useUtils();

  // Native: the OAuth deep link (raritygrid://auth?token=…) arrives through
  // Capacitor's App plugin (also accept it on first load), and the status
  // bar takes the dark style. Both plugins are loaded lazily so the web
  // bundle never pays for them.
  useEffect(() => {
    if (!isNative()) return;
    if (consumeAuthDeepLink(window.location.href)) utils.auth.me.invalidate();
    let cancelled = false;
    let handle: { remove: () => Promise<void> | void } | null = null;
    void (async () => {
      try {
        const [{ App }, { StatusBar, Style }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar"),
        ]);
        StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
        if (cancelled) return;
        handle = await App.addListener("appUrlOpen", ({ url }) => {
          if (consumeAuthDeepLink(url)) utils.auth.me.invalidate();
        });
        if (cancelled) void handle.remove();
      } catch {
        // Plugins missing (e.g. a plain browser with VITE_API_BASE set): no-op.
      }
    })();
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [utils]);

  const { user } = useAuth();
  useEffect(() => {
    identify(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    track("app_open", { path: location, currency });
    // One open event per shell mount, not per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useT();
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const names: Record<string, string> = {
      "/app": t("Home"),
      "/app/scan": t("Scan a card"),
      "/app/collection": t("Collection"),
      "/app/portfolio": t("Portfolio"),
      "/app/alerts": t("Alerts"),
      "/app/settings": t("Settings"),
    };
    const name = names[location.replace(/\/$/, "")] ?? names["/app"];
    document.title = `${name} · RarityGrid`;
  }, [location, t]);

  return (
    <div className="app-shell mx-auto w-full max-w-lg">
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          <Route path="/app" component={AppHome} />
          <Route path="/app/scan" component={AppScan} />
          <Route path="/app/collection" component={AppCollection} />
          <Route path="/app/portfolio" component={AppPortfolio} />
          <Route path="/app/alerts" component={AppAlerts} />
          <Route path="/app/settings" component={AppSettings} />
          <Route component={AppHome} />
        </Switch>
      </Suspense>
      <TabBar />
    </div>
  );
}

export default function AppShell() {
  return (
    <PrefsProvider>
      <ProProvider>
        <ShellBody />
      </ProProvider>
    </PrefsProvider>
  );
}
