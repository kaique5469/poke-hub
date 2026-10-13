import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ScanLine } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_STORAGE_KEYS } from "@shared/app";
import { useCount, useT } from "../i18n";
import { AppHeader } from "../components/AppHeader";
import { ChangePercent, Money } from "../components/Money";
import { SignInCard } from "../components/SignInCard";
import { usePending } from "../pending";

type RecentScan = {
  id: string;
  name: string;
  setName: string;
  number: string;
  imageUrl: string;
  priceUsd: number | null;
  at: string;
};

function readRecent(): RecentScan[] {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEYS.recentScans);
    return raw ? (JSON.parse(raw) as RecentScan[]) : [];
  } catch {
    return [];
  }
}

export default function AppHome() {
  const t = useT();
  const count = useCount();
  const { isAuthenticated } = useAuth();
  const { items: pending } = usePending();
  const portfolio = trpc.market.portfolio.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const market = trpc.market.overview.useQuery({ period: 7 }, { staleTime: 10 * 60 * 1000 });
  const [recent, setRecent] = useState<RecentScan[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  const value = portfolio.data?.currentValue ?? null;
  const totalCards = portfolio.data?.totalCards ?? 0;
  const trending = [...(market.data?.gainers ?? []), ...(market.data?.losers ?? [])]
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
    .slice(0, 6);

  return (
    <div className="app-page">
      <AppHeader title="RarityGrid" />

      {/* Scan is the product; it goes first, big, every time. */}
      <Link
        href="/app/scan"
        className="flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground active:scale-[0.99] transition-transform"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ScanLine className="h-7 w-7" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-extrabold leading-tight">{t("Scan a card")}</span>
          <span className="block text-sm opacity-90">
            {t("Point the camera at a card to see its value in seconds.")}
          </span>
        </span>
      </Link>

      {/* Collection summary or the save-your-cards prompt */}
      {isAuthenticated ? (
        <Link
          href="/app/portfolio"
          className="mt-3 block rounded-2xl border border-border bg-card p-4"
        >
          <p className="text-xs font-semibold text-muted-foreground">{t("Your collection")}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <Money usd={value ?? 0} dual size="lg" className="app-gold" />
            <div className="text-right text-sm">
              <ChangePercent value={portfolio.data?.change7d ?? null} />
              <p className="text-muted-foreground">
                {count(totalCards, "card", "cards")}
              </p>
            </div>
          </div>
        </Link>
      ) : pending.length > 0 ? (
        <div className="mt-3">
          <SignInCard
            title={count(pending.length, "card waiting to be saved", "cards waiting to be saved")}
            body={t("Create a free account to keep them.")}
            cta={t("Save my cards")}
            next="/app"
          />
        </div>
      ) : null}

      {/* Recent scans */}
      <section className="mt-6">
        <h2 className="mb-2 text-base font-bold">{t("Recent scans")}</h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <p className="font-semibold">{t("Nothing scanned yet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Your first scan takes about five seconds.")}
            </p>
          </div>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {recent.map(scan => (
              <Link
                key={`${scan.id}-${scan.at}`}
                href={`/cards/${scan.id}`}
                className="w-[112px] shrink-0"
              >
                <img
                  src={scan.imageUrl}
                  alt={scan.name}
                  className="aspect-[63/88] w-full rounded-lg object-cover"
                  loading="lazy"
                />
                <p className="mt-1 truncate text-xs font-semibold">{scan.name}</p>
                <Money usd={scan.priceUsd} size="sm" className="text-xs app-gold" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Market movers */}
      {trending.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-bold">{t("Trending today")}</h2>
            <Link href="/market" className="text-xs font-semibold text-muted-foreground">
              {t("See all")}
            </Link>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {trending.map(card => (
              <li key={card.cardId}>
                <Link href={`/cards/${card.cardId}`} className="flex items-center gap-3 p-2.5">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt="" className="h-14 w-10 rounded-md object-cover" loading="lazy" />
                  ) : (
                    <span className="h-14 w-10 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{card.cardName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{card.setName}</p>
                  </div>
                  <div className="text-right">
                    <Money usd={card.price} size="sm" className="font-bold" />
                    <div className="text-xs">
                      <ChangePercent value={card.changePercent} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
