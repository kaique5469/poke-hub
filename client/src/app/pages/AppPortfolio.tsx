import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useT, useLocale } from "../i18n";
import { usePrefs } from "../prefs";
import { AppHeader } from "../components/AppHeader";
import { ChangePercent, Money } from "../components/Money";
import { EmptyState, SignInCard } from "../components/SignInCard";
import { ProLock, usePro } from "../pro";
import { FREE_HISTORY_DAYS } from "@shared/app";

type Range = 7 | 30 | 90 | 365;

export default function AppPortfolio() {
  const t = useT();
  const locale = useLocale();
  const { money, toDisplay, currency } = usePrefs();
  const { isAuthenticated, loading } = useAuth();
  const portfolio = trpc.market.portfolio.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const [range, setRange] = useState<Range>(30);
  const { isPro, openPaywall } = usePro();

  const data = portfolio.data;
  const history = useMemo(() => {
    if (!data?.history) return [];
    const since = Date.now() - range * 86_400_000;
    return data.history
      .filter(p => p.recordedAt && new Date(p.recordedAt).getTime() >= since)
      .map(p => ({
        t: new Date(p.recordedAt as string).getTime(),
        value: toDisplay(Number(p.value)) ?? 0,
      }));
  }, [data?.history, range, toDisplay]);

  const changeInRange =
    history.length >= 2
      ? ((history[history.length - 1].value - history[0].value) /
          Math.max(history[0].value, 0.01)) *
        100
      : null;

  const positions = data?.positions ?? [];
  const movers = positions.filter(p => p.change7d != null && Number.isFinite(p.change7d));
  const gainers = [...movers].sort((a, b) => (b.change7d ?? 0) - (a.change7d ?? 0)).slice(0, 5);
  const losers = [...movers].sort((a, b) => (a.change7d ?? 0) - (b.change7d ?? 0)).filter(p => (p.change7d ?? 0) < 0).slice(0, 5);
  const valuable = [...positions].sort((a, b) => b.value - a.value).slice(0, 6);

  const dateFmt = new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "numeric",
    month: "short",
  });

  if (!loading && !isAuthenticated) {
    return (
      <div className="app-page">
        <AppHeader title={t("Portfolio")} />
        <SignInCard
          title={t("Sign in to see your collection")}
          body={t("Your cards sync across devices once you sign in.")}
          next="/app/portfolio"
        />
      </div>
    );
  }

  return (
    <div className="app-page">
      <AppHeader title={t("Portfolio")} />

      {/* Hero number: the collection's value, in both currencies. */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("Collection value")}
        </p>
        <Money usd={data?.currentValue ?? 0} dual size="xl" className="app-gold mt-1" />
        <div className="mt-2 flex items-center gap-2 text-sm">
          <ChangePercent value={data?.change7d ?? null} />
          <span className="text-muted-foreground">{t("last 7 days")}</span>
        </div>

        {history.length >= 2 ? (
          <div className="mt-3 h-36 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--app-gold)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--app-gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide domain={["dataMin", "dataMax"]} type="number" />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    color: "var(--color-foreground)",
                    fontSize: 12,
                  }}
                  labelFormatter={v => dateFmt.format(new Date(Number(v)))}
                  formatter={(v: number) => [
                    new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
                      style: "currency",
                      currency,
                    }).format(v),
                    t("Collection value"),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--app-gold)"
                  strokeWidth={2}
                  fill="url(#pfFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-background)" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("No price history yet")} · {t("Values are refreshed daily from market data.")}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {([7, 30, 90, 365] as Range[]).map(r => {
              const locked = r > FREE_HISTORY_DAYS && !isPro;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => (locked ? openPaywall("history") : setRange(r))}
                  aria-pressed={range === r}
                  className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold ${
                    range === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {r === 365 ? "1A" : `${r}D`}
                  {locked && <ProLock />}
                </button>
              );
            })}
          </div>
          {changeInRange != null && <ChangePercent value={changeInRange} className="text-sm" />}
        </div>
      </section>

      {/* Cost basis */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">{t("Cost")}</p>
          <p className="mt-1 text-base font-bold">{money(data?.totalCost ?? 0, { compact: true })}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">
            {(data?.unrealizedGain ?? 0) >= 0 ? t("Gain") : t("Loss")}
          </p>
          <p
            className={`mt-1 text-base font-bold ${
              (data?.unrealizedGain ?? 0) >= 0 ? "app-up" : "app-down"
            }`}
          >
            {money(data?.unrealizedGain ?? 0, { compact: true, signed: true })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">{t("Priced")}</p>
          <p className="mt-1 text-base font-bold">
            {data?.pricedCards ?? 0}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}{t("of")} {data?.uniqueCards ?? 0}
            </span>
          </p>
        </div>
      </section>
      {data && data.costedCards === 0 && data.uniqueCards > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t("Add what you paid to see your real gain.")}</p>
      )}

      {positions.length === 0 && !portfolio.isLoading && (
        <div className="mt-4">
          <EmptyState
            title={t("Your collection is empty")}
            body={t("Scan your first card and it shows up here.")}
            action={
              <Link
                href="/app/scan"
                className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground"
              >
                {t("Scan a card")}
              </Link>
            }
          />
        </div>
      )}

      {valuable.length > 0 && (
        <MoverList title={t("Most valuable")} rows={valuable} showChange={false} />
      )}
      {gainers.some(g => (g.change7d ?? 0) > 0) && (
        <MoverList title={t("Top gainers")} rows={gainers.filter(g => (g.change7d ?? 0) > 0)} />
      )}
      {losers.length > 0 && <MoverList title={t("Top losers")} rows={losers} />}
    </div>
  );
}

function MoverList({
  title,
  rows,
  showChange = true,
}: {
  title: string;
  rows: Array<{
    id: number;
    cardId: string;
    cardName: string;
    setName: string | null;
    imageUrl: string | null;
    quantity: number;
    currentPrice: number | null;
    value: number;
    change7d: number | null;
  }>;
  showChange?: boolean;
}) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-base font-bold">{title}</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {rows.map(row => (
          <li key={row.id}>
            <Link
              href={`/cards/${row.cardId}`}
              className="flex items-center gap-3 p-2.5"
            >
              {row.imageUrl ? (
                <img src={row.imageUrl} alt="" className="h-14 w-10 rounded-md object-cover" />
              ) : (
                <span className="h-14 w-10 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.cardName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.setName}
                  {row.quantity > 1 ? ` · ×${row.quantity}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Money usd={row.value} size="sm" className="font-bold" />
                {showChange && (
                  <div className="text-xs">
                    <ChangePercent value={row.change7d} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
