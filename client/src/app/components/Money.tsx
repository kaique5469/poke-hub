import { usePrefs } from "../prefs";
import { useT } from "../i18n";

/**
 * A USD amount shown in the display currency, with the other currency as a
 * quiet second line when `dual` is set. BRL is labelled as an estimate: it
 * comes from the daily reference rate, not from Brazilian market data.
 */
export function Money({
  usd,
  dual = false,
  size = "md",
  signed = false,
  className = "",
}: {
  usd: number | null | undefined;
  dual?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  signed?: boolean;
  className?: string;
}) {
  const { money, moneyIn, toDisplay, currency, secondaryCurrency, fx } =
    usePrefs();
  const t = useT();
  if (usd == null || !Number.isFinite(usd)) {
    return (
      <span className={`text-muted-foreground ${className}`}>
        {t("No price yet")}
      </span>
    );
  }
  const primary = money(usd, { signed });
  const rate = fx?.rates[secondaryCurrency] ?? (secondaryCurrency === "BRL" ? 5.5 : 1);
  const secondary = moneyIn(Math.round(usd * rate * 100) / 100, secondaryCurrency, {
    signed,
  });
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl app-figure",
    xl: "text-[40px] app-figure",
  } as const;
  const isEstimate = currency === "BRL";
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span
        className={sizes[size]}
        title={isEstimate ? t("Estimated from exchange rate") : undefined}
      >
        {primary}
      </span>
      {dual && (
        <span className="text-xs text-muted-foreground">
          {secondary}
          {secondaryCurrency === "BRL" && (
            <span className="sr-only"> · {t("Estimated from exchange rate")}</span>
          )}
        </span>
      )}
    </span>
  );
}

export function ChangePercent({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span className={`${up ? "app-up" : "app-down"} font-semibold ${className}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function useDisplayTotal(usd: number | null | undefined) {
  const { toDisplay } = usePrefs();
  return toDisplay(usd);
}
