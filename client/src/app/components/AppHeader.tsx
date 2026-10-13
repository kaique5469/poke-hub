import { Link } from "wouter";
import { Settings } from "lucide-react";
import { usePrefs } from "../prefs";
import { useT } from "../i18n";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Compact header: page title, the currency toggle (the one setting people
 * flip constantly when they buy in one market and sell in another) and a
 * settings/avatar button.
 */
export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { currency, setCurrency } = usePrefs();
  const { user } = useAuth();
  const t = useT();
  const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <button
          type="button"
          onClick={() => setCurrency(currency === "USD" ? "BRL" : "USD")}
          className="h-9 rounded-full border border-border bg-secondary px-3 text-xs font-bold tracking-wide text-secondary-foreground active:scale-95 transition-transform"
          aria-label={`${t("Currency")}: ${currency}`}
        >
          {currency === "USD" ? "US$" : "R$"}
        </button>
        <Link
          href="/app/settings"
          aria-label={t("Settings")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-sm font-bold text-secondary-foreground"
        >
          {user ? initial : <Settings className="h-4 w-4" aria-hidden />}
        </Link>
      </div>
    </header>
  );
}
