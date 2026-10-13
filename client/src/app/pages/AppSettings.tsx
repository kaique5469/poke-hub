import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { usePro } from "../pro";
import { track } from "../analytics";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_CURRENCIES, APP_LOCALES } from "@shared/app";
import { useLocale, useT } from "../i18n";
import { usePrefs } from "../prefs";
import { AppHeader } from "../components/AppHeader";
import { SignInCard } from "../components/SignInCard";

type InstallPrompt = Event & { prompt: () => Promise<void> };

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 rounded-lg text-sm font-bold ${
            value === o.value ? "bg-primary text-primary-foreground" : "text-secondary-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AppSettings() {
  const t = useT();
  const uiLocale = useLocale();
  const { locale, currency, setLocale, setCurrency, fx } = usePrefs();
  const { user, isAuthenticated, logout } = useAuth();
  const { isPro, openPaywall } = usePro();
  const utils = trpc.useUtils();
  const billing = trpc.billing.status.useQuery(undefined, { staleTime: 60_000 });
  const portal = trpc.billing.portal.useMutation();
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  // Back from Stripe Checkout: refresh entitlement and say what happened.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("pro");
    if (!result) return;
    window.history.replaceState({}, "", "/app/settings");
    if (result === "success") {
      track("paywall_converted");
      toast.success(t("Welcome to Pro!"));
      utils.auth.me.invalidate();
      utils.billing.status.invalidate();
    } else if (result === "cancelled") {
      toast(t("Checkout cancelled"));
    } else if (result === "start") {
      openPaywall("post_login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateFmt = new Intl.DateTimeFormat(uiLocale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="app-page">
      <AppHeader title={t("Settings")} />

      <section className="space-y-5 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="mb-2 text-sm font-bold">{t("Language")}</h2>
          <Segmented
            label={t("Language")}
            value={locale}
            onChange={setLocale}
            options={APP_LOCALES.map(l => ({ value: l, label: l === "pt-BR" ? "Português" : "English" }))}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-bold">{t("Currency")}</h2>
          <Segmented
            label={t("Currency")}
            value={currency}
            onChange={setCurrency}
            options={APP_CURRENCIES.map(c => ({ value: c, label: c === "USD" ? "US$ USD" : "R$ BRL" }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Prices in BRL are converted from USD at the daily reference rate.")}
            {fx && (
              <>
                {" "}
                {t("Rate")}: US$ 1 = R$ {fx.rates.BRL.toFixed(2)}
                {fx.source === "cache" ? " (cache)" : fx.source === "fallback" ? " (aprox.)" : ""}
              </>
            )}
          </p>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--app-gold)]/60 bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">RarityGrid Pro</h2>
          {isPro && (
            <span className="rounded-md bg-[var(--app-gold)] px-2 py-0.5 text-[11px] font-bold text-black">
              {t("You are Pro")}
            </span>
          )}
        </div>
        {isPro ? (
          <>
            {billing.data?.proUntil && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Renews")} {dateFmt.format(new Date(billing.data.proUntil))}
              </p>
            )}
            {billing.data?.canManage && (
              <button
                type="button"
                disabled={portal.isPending}
                onClick={async () => {
                  try {
                    const { url } = await portal.mutateAsync();
                    window.location.href = url;
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
                className="mt-3 h-11 w-full rounded-xl border border-border bg-secondary text-sm font-bold disabled:opacity-60"
              >
                {t("Manage subscription")}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Everything for collectors who buy, sell and trade.")}
            </p>
            <button
              type="button"
              onClick={() => openPaywall("settings")}
              className="mt-3 h-11 w-full rounded-xl bg-[var(--app-gold)] text-sm font-extrabold text-black"
            >
              {t("Get Pro")}
            </button>
          </>
        )}
      </section>

      {install && (
        <section className="mt-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">{t("Install the app")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Add RarityGrid to your home screen for one-tap scanning.")}
          </p>
          <button
            type="button"
            onClick={() => {
              install.prompt();
              setInstall(null);
            }}
            className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            {t("Install the app")}
          </button>
        </section>
      )}

      <section className="mt-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">{t("Account")}</h2>
        {isAuthenticated && user ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Signed in as")} {user.email ?? user.name}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/dashboard"
                className="flex h-11 items-center justify-center rounded-xl border border-border bg-secondary text-sm font-bold"
              >
                {t("Open website")}
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="h-11 rounded-xl border border-border text-sm font-bold text-[var(--app-down)]"
              >
                {t("Sign out")}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <SignInCard
              title={t("Create account")}
              body={t("Your cards sync across devices once you sign in.")}
              next="/app"
            />
          </div>
        )}
      </section>

      <nav className="mt-5 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/privacy">{t("Privacy")}</Link>
        <Link href="/terms">{t("Terms")}</Link>
        <Link href="/contact">{t("Contact")}</Link>
      </nav>
    </div>
  );
}
