/**
 * RarityGrid Pro on the client: entitlement, the paywall sheet and the hook
 * pages use to gate a feature. The paywall opens only when a Pro feature is
 * touched — never on launch, never on a timer.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PRO_FEATURES, isPro, type ProInterval } from "@shared/app";
import { useLocale, useT } from "./i18n";
import { usePrefs } from "./prefs";
import { track } from "./analytics";

type ProContext = {
  isPro: boolean;
  /** Opens the paywall; `feature` names what was touched, for analytics. */
  openPaywall: (feature: string) => void;
};

const Ctx = createContext<ProContext>({ isPro: false, openPaywall: () => undefined });

export function usePro() {
  return useContext(Ctx);
}

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string>("");
  const pro = isPro(user);
  const openPaywall = useCallback(
    (f: string) => {
      track("paywall_viewed", { feature: f });
      setFeature(f);
      setOpen(true);
    },
    []
  );
  const value = useMemo(() => ({ isPro: pro, openPaywall }), [pro, openPaywall]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Paywall open={open} onOpenChange={setOpen} feature={feature} />
    </Ctx.Provider>
  );
}

/** Small lock badge for buttons that lead to the paywall. */
export function ProLock({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-[var(--app-gold)] px-1.5 py-0.5 text-[10px] font-bold text-black ${className}`}
    >
      <Lock className="h-3 w-3" aria-hidden /> PRO
    </span>
  );
}

function Paywall({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
}) {
  const t = useT();
  const locale = useLocale();
  const { currency, moneyIn } = usePrefs();
  const { isAuthenticated } = useAuth();
  const status = trpc.billing.status.useQuery(undefined, { enabled: open, staleTime: 60_000 });
  const checkout = trpc.billing.checkout.useMutation();
  const [interval, setInterval] = useState<ProInterval>("year");

  const prices = status.data?.prices[currency];
  const yearlySaving =
    prices ? Math.round((1 - prices.year / (prices.month * 12)) * 100) : 0;

  async function subscribe() {
    if (!isAuthenticated) {
      window.location.href = `/login?next=${encodeURIComponent("/app/settings?pro=start")}`;
      return;
    }
    try {
      track("paywall_checkout_started", { interval, currency, feature });
      const { url } = await checkout.mutateAsync({ interval, currency, locale });
      window.location.href = url;
    } catch (error) {
      toast.error((error as Error).message || t("Retry"));
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="app-dark border-border bg-background">
        <div className="overflow-y-auto px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-2">
          <DrawerTitle className="text-2xl font-extrabold">RarityGrid Pro</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {t("Everything for collectors who buy, sell and trade.")}
          </DrawerDescription>

          <ul className="mt-4 space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-[var(--app-up)]" aria-hidden />
                {t(f)}
              </li>
            ))}
          </ul>

          {prices && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["month", "year"] as ProInterval[]).map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterval(i)}
                  aria-pressed={interval === i}
                  className={`rounded-xl border p-3 text-left ${
                    interval === i ? "border-primary bg-primary/15" : "border-border bg-secondary"
                  }`}
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    {i === "month" ? t("Monthly") : t("Yearly")}
                  </p>
                  <p className="text-lg font-extrabold">
                    {moneyIn(prices[i], currency)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{i === "month" ? t("mo") : t("yr")}
                    </span>
                  </p>
                  {i === "year" && yearlySaving > 0 && (
                    <p className="text-[11px] font-semibold text-[var(--app-up)]">
                      {t("Save {pct}%", { pct: yearlySaving })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {status.data && !status.data.available ? (
            <p className="mt-5 rounded-xl border border-border bg-card p-3 text-center text-sm text-muted-foreground">
              {t("Pro is almost ready. Everything free stays free.")}
            </p>
          ) : (
            <button
              type="button"
              onClick={subscribe}
              disabled={checkout.isPending || status.isLoading}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--app-gold)] text-base font-extrabold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {checkout.isPending ? t("Loading…") : t("Get Pro")}
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {t("Cancel anytime. Prices in BRL are charged in BRL.")}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
