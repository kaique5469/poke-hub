import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Clock3,
  Database,
  Eye,
  Heart,
  Info,
  LineChart as LineChartIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Period = 1 | 7 | 30;

const money = (value: number | string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(value));

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);

const signedPercent = (value: number | null | undefined) =>
  value == null ? "Collecting" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

function ChangePill({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
        Building history
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black",
        positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      )}
    >
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {signedPercent(value)}
    </span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
      <Database size={10} /> {source}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
        <span className="rounded-xl bg-white/5 p-2 text-violet-300">
          <Icon size={17} />
        </span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}

function CardThumb({ src, name }: { src?: string | null; name: string }) {
  return (
    <span className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <WalletCards size={18} className="text-slate-300" />
      )}
    </span>
  );
}

function MoverRow({ card, rank }: { card: any; rank: number }) {
  return (
    <Link
      href={`/cards/${card.cardId}`}
      className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 last:border-0 sm:grid-cols-[28px_1fr_105px_100px]"
    >
      <span className="text-center text-xs font-black text-slate-300">
        {rank}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <CardThumb src={card.imageUrl} name={card.cardName} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-900">
            {card.cardName}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {card.setName}
          </span>
          <SourceBadge source={card.source} />
        </span>
      </span>
      <span className="hidden text-right sm:block">
        <span className="block text-sm font-black text-slate-900">
          {money(card.price)}
        </span>
        {card.baselinePrice != null && (
          <span className="text-[10px] text-slate-400">
            from {money(card.baselinePrice)}
          </span>
        )}
      </span>
      <ChangePill value={card.changePercent} />
    </Link>
  );
}

function MoversPanel({
  title,
  icon: Icon,
  cards,
  tone,
}: {
  title: string;
  icon: typeof TrendingUp;
  cards: any[];
  tone: "up" | "down";
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
          <span
            className={cn(
              "rounded-lg p-2",
              tone === "up"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            )}
          >
            <Icon size={16} />
          </span>
          {title}
        </h2>
        <Badge variant="outline" className="text-[10px]">
          Verified snapshots
        </Badge>
      </div>
      {cards.length > 0 ? (
        cards.map((card, index) => (
          <MoverRow key={card.cardId} card={card} rank={index + 1} />
        ))
      ) : (
        <div className="px-6 py-10 text-center">
          <LineChartIcon className="mx-auto mb-3 text-slate-300" size={30} />
          <p className="font-bold text-slate-700">
            The baseline is being collected
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
            Movements appear only after enough time has passed for a truthful
            comparison.
          </p>
        </div>
      )}
    </section>
  );
}

function DemandRow({
  item,
  metric,
  icon: Icon,
}: {
  item: any;
  metric: string;
  icon: typeof Eye;
}) {
  return (
    <Link
      href={`/cards/${item.cardId}`}
      className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 hover:opacity-75"
    >
      <CardThumb src={item.imageUrl} name={item.cardName ?? "Card"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-900">
          {item.cardName}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {item.setName}
        </span>
      </span>
      <span className="text-right">
        <span className="flex items-center justify-end gap-1 text-sm font-black text-slate-800">
          <Icon size={13} className="text-violet-500" /> {metric}
        </span>
        {item.currentPrice != null && (
          <span className="text-[10px] text-slate-400">
            {money(item.currentPrice)}
          </span>
        )}
      </span>
    </Link>
  );
}

function WatchTarget({ item }: { item: any }) {
  const utils = trpc.useUtils();
  const [target, setTarget] = useState(
    item.targetPriceUsd == null ? "" : String(item.targetPriceUsd)
  );
  const mutation = trpc.market.setTarget.useMutation({
    onSuccess: () => {
      toast.success(target ? "Price alert saved" : "Price alert removed");
      utils.market.watchlist.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-24">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          $
        </span>
        <Input
          value={target}
          onChange={event => setTarget(event.target.value)}
          inputMode="decimal"
          placeholder="Target"
          className="h-8 pl-5 text-xs"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs"
        disabled={mutation.isPending}
        onClick={() => {
          const value = target.trim() ? Number(target) : null;
          if (value != null && (!Number.isFinite(value) || value <= 0)) {
            toast.error("Enter a valid target price");
            return;
          }
          mutation.mutate({ cardId: item.cardId, targetPriceUsd: value });
        }}
      >
        <BellRing size={12} />
      </Button>
    </div>
  );
}

export default function MarketPulse() {
  usePageMeta(
    "Market Pulse",
    "Real Pokémon TCG price movements, collector demand, completed sales and watchlist alerts."
  );
  const [period, setPeriod] = useState<Period>(7);
  const { isAuthenticated } = useAuth();
  const overview = trpc.market.overview.useQuery(
    { period },
    { staleTime: 60_000, refetchInterval: 60_000, retry: 1 }
  );
  const watchlist = trpc.market.watchlist.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const portfolio = trpc.market.portfolio.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const data = overview.data;
  const indexData = useMemo(
    () =>
      (data?.marketIndex ?? []).map(point => ({
        ...point,
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      })),
    [data?.marketIndex]
  );

  if (overview.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-slate-950 py-12">
          <div className="container space-y-4">
            <Skeleton className="h-8 w-56 bg-slate-800" />
            <Skeleton className="h-14 max-w-2xl bg-slate-800" />
            <div className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 bg-slate-800" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(124,58,237,.28),transparent_32%),radial-gradient(circle_at_85%_30%,rgba(16,185,129,.14),transparent_28%)]" />
        <div className="container relative py-10 md:py-14">
          <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-200 hover:bg-violet-500/15">
                  <Activity size={12} className="mr-1" /> Collector intelligence
                </Badge>
                <span className="text-xs text-slate-500">
                  Prices scheduled every 6 hours · RarityGrid activity refreshes
                  every minute
                </span>
              </div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
                Read the market before you trade.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Verified price snapshots, first-party collector activity and
                completed RarityGrid sales—clearly separated by source.
              </p>
            </div>
            <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
              {([1, 7, 30] as Period[]).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-black transition",
                    period === value
                      ? "bg-white text-slate-950"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {value === 1 ? "24H" : `${value}D`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={BarChart3}
              label="Tracked cards"
              value={compact(data?.summary.trackedCards ?? 0)}
              note="Cards with verified price observations"
            />
            <SummaryCard
              icon={Search}
              label="Search activity"
              value={compact(data?.summary.searches24h ?? 0)}
              note="Search selections on RarityGrid · 24h"
            />
            <SummaryCard
              icon={ShoppingBag}
              label="Completed sales"
              value={compact(data?.summary.sales30d ?? 0)}
              note="Paid card units on RarityGrid · 30d"
            />
            <SummaryCard
              icon={Activity}
              label="RarityGrid volume"
              value={money(data?.summary.volume30d ?? 0)}
              note="Paid card volume on RarityGrid · 30d"
            />
          </div>
          {data?.summary.lastUpdated && (
            <p className="mt-4 text-right text-[10px] text-slate-600">
              Last price observation{" "}
              {new Date(data.summary.lastUpdated).toLocaleString("en-US")}
            </p>
          )}
        </div>
      </section>

      <main className="container space-y-7 py-8 md:py-10">
        <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <LineChartIcon size={19} className="text-violet-600" />{" "}
                  Tracked market index
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Equal-weight performance of cards with collected snapshots.
                  Baseline = 100.
                </p>
              </div>
              <Badge variant="outline">
                {indexData.at(-1)?.cards ?? 0} cards
              </Badge>
            </div>
            {indexData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={indexData}>
                  <defs>
                    <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#7c3aed"
                        stopOpacity={0.24}
                      />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toFixed(2)}`,
                      "Index",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    fill="url(#marketFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[270px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <Sparkles className="mb-3 text-violet-300" size={30} />
                <p className="font-black text-slate-700">
                  First verified baseline captured
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                  The index and movers will activate after the next scheduled
                  observation. No synthetic chart points are used.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <WalletCards size={19} className="text-amber-500" /> My
                collection
              </h2>
              <Link
                href="/binder"
                className="text-xs font-bold text-violet-600 hover:underline"
              >
                Open binder
              </Link>
            </div>
            {!isAuthenticated ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl bg-slate-950 p-6 text-center text-white">
                <Target className="mb-3 text-violet-300" size={34} />
                <p className="text-lg font-black text-white">
                  Turn your binder into a portfolio
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Follow collection value and create price alerts for the cards
                  you want.
                </p>
                <Button
                  className="mt-5 bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign in free
                </Button>
              </div>
            ) : (
              <div>
                <div className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                    Reference collection value
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {money(portfolio.data?.currentValue ?? 0)}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-violet-200">
                      {portfolio.data?.totalCards ?? 0} cards ·{" "}
                      {portfolio.data?.uniqueCards ?? 0} unique
                    </span>
                    <ChangePill value={portfolio.data?.change7d} />
                  </div>
                  <p className="mt-2 text-[10px] text-violet-300/70">
                    {portfolio.data?.pricedCards ?? 0} positions priced · raw/NM
                    market where available, otherwise saved binder price · not
                    condition-adjusted
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {(portfolio.data?.positions ?? []).slice(0, 3).map(item => (
                    <Link
                      key={item.cardId}
                      href={`/cards/${item.cardId}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-slate-800">
                          {item.cardName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ×{item.quantity}
                        </span>
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {money(item.value)}
                      </span>
                    </Link>
                  ))}
                  {(portfolio.data?.positions.length ?? 0) === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Add cards to your binder to begin tracking.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <MoversPanel
            title={`Biggest gainers · ${period === 1 ? "24h" : `${period}d`}`}
            icon={TrendingUp}
            cards={data?.gainers ?? []}
            tone="up"
          />
          <MoversPanel
            title={`Biggest decliners · ${period === 1 ? "24h" : `${period}d`}`}
            icon={TrendingDown}
            cards={data?.losers ?? []}
            tone="down"
          />
        </section>

        {(data?.gainers.length ?? 0) === 0 &&
          (data?.tracked.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="text-violet-600" size={19} />
                <h2 className="font-black text-slate-900">
                  Cards currently building a verified baseline
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data?.tracked.slice(0, 8).map(card => (
                  <Link
                    key={card.cardId}
                    href={`/cards/${card.cardId}`}
                    className="flex items-center gap-3 rounded-xl border border-white bg-white p-3 shadow-sm hover:border-violet-200"
                  >
                    <CardThumb src={card.imageUrl} name={card.cardName} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-slate-900">
                        {card.cardName}
                      </span>
                      <span className="block text-sm font-black text-violet-700">
                        {money(card.price)}
                      </span>
                      <SourceBadge source={card.source} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Collector attention
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                First-party RarityGrid demand signals—not global market claims.
              </p>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <Search size={16} className="text-violet-600" /> Most researched
              </h3>
              {(data?.demand.length ?? 0) > 0 ? (
                data?.demand
                  .slice(0, 5)
                  .map(item => (
                    <DemandRow
                      key={item.cardId}
                      item={item}
                      metric={`${item.searches} searches · ${item.views} views`}
                      icon={Eye}
                    />
                  ))
              ) : (
                <EmptySignal text="Search activity will appear as collectors use the card database." />
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <Heart size={16} className="text-rose-500" /> Most watched
              </h3>
              {(data?.mostWatched.length ?? 0) > 0 ? (
                data?.mostWatched
                  .slice(0, 5)
                  .map(item => (
                    <DemandRow
                      key={item.cardId}
                      item={item}
                      metric={`${item.watchers} watchers`}
                      icon={Heart}
                    />
                  ))
              ) : (
                <EmptySignal text="Cards added to collector watchlists will rank here." />
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 font-black text-slate-900">
                <ShoppingBag size={16} className="text-emerald-600" /> Most sold
                on RarityGrid
              </h3>
              {(data?.topSales.length ?? 0) > 0 ? (
                data?.topSales
                  .slice(0, 5)
                  .map(item => (
                    <DemandRow
                      key={item.cardId}
                      item={item}
                      metric={`${item.units} sold · ${money(item.volume)}`}
                      icon={ShoppingBag}
                    />
                  ))
              ) : (
                <EmptySignal text="Only paid RarityGrid orders are counted here." />
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Clock3 size={18} className="text-emerald-600" /> Latest
                completed card sales
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Paid RarityGrid orders only. This is first-party marketplace
                activity, not global sales data.
              </p>
            </div>
            <Badge variant="outline" className="w-fit text-[10px]">
              Verified at checkout
            </Badge>
          </div>
          {(data?.recentSales.length ?? 0) > 0 ? (
            <div className="grid md:grid-cols-2">
              {data?.recentSales.map(sale => (
                <Link
                  key={sale.orderId}
                  href={`/cards/${sale.cardId}`}
                  className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 md:odd:border-r"
                >
                  <CardThumb src={sale.imageUrl} name={sale.cardName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {sale.cardName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {sale.setName} · ×{sale.quantity}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-black text-emerald-700">
                      {money(sale.totalUsd)}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {sale.soldAt
                        ? new Date(sale.soldAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Completed"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <ShoppingBag className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">
                No paid card sales to show yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                The feed activates automatically after a marketplace checkout is
                confirmed.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <BellRing size={18} className="text-violet-600" /> My market
                  watchlist
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Set a one-time buy target and receive an in-app notification
                  when the current tracked price falls to or below it.
                </p>
              </div>
            </div>
            {!isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <p className="font-bold text-slate-700">
                  Sign in to follow cards and create alerts.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign in
                </Button>
              </div>
            ) : (watchlist.data?.length ?? 0) > 0 ? (
              <div>
                {watchlist.data?.slice(0, 6).map(item => (
                  <div
                    key={item.cardId}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 py-3 last:border-0 md:grid-cols-[1fr_100px_170px]"
                  >
                    <Link
                      href={`/cards/${item.cardId}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <CardThumb src={item.imageUrl} name={item.cardName} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-900">
                          {item.cardName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {item.setName}
                        </span>
                      </span>
                    </Link>
                    <span className="hidden text-right md:block">
                      <span className="block text-sm font-black text-slate-900">
                        {money(item.currentPrice)}
                      </span>
                      <ChangePill value={item.change7d} />
                    </span>
                    <WatchTarget item={item} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <Heart className="mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700">
                  Your watchlist is empty
                </p>
                <Link
                  href="/cards"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-violet-600"
                >
                  Browse cards <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <Info size={18} className="text-violet-300" /> Transparent by
              design
            </h2>
            <div className="mt-5 space-y-4">
              {[
                [
                  "Prices",
                  data?.methodology.price,
                  "Updated from named third-party sources",
                ],
                [
                  "Demand",
                  data?.methodology.demand,
                  "First-party activity only",
                ],
                [
                  "Sales",
                  data?.methodology.sales,
                  "No pending or unpaid orders",
                ],
              ].map(([title, value, note]) => (
                <div
                  key={title}
                  className="border-b border-slate-800 pb-4 last:border-0"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                    {title}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-200">
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{note}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[10px] leading-4 text-slate-600">
              Market Pulse is a collector information tool, not financial
              advice. Pokémon cards are illiquid collectibles and historical
              prices do not guarantee future value.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptySignal({ text }: { text: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center text-center">
      <Activity size={28} className="mb-3 text-slate-200" />
      <p className="max-w-xs text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
