import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Grid2X2, Grid3X3, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  APP_STORAGE_KEYS,
  isCardVariant,
  type CardCondition,
  type CardVariant,
} from "@shared/app";
import { useCount, useT } from "../i18n";
import { usePrefs } from "../prefs";
import { AppHeader } from "../components/AppHeader";
import { CardTile } from "../components/CardTile";
import { Money } from "../components/Money";
import { ConditionPicker, Stepper } from "../components/pickers";
import { EmptyState, SignInCard } from "../components/SignInCard";
import { usePending } from "../pending";

type SortKey = "newest" | "value" | "name";

type Row = {
  id: number | string;
  cardId: string;
  cardName: string;
  setName: string | null;
  setId: string | null;
  imageUrl: string | null;
  rarity: string | null;
  quantity: number;
  condition: CardCondition;
  variant: CardVariant;
  priceUsd: number | null;
  purchasePriceUsd: number | null;
  pending: boolean;
};

function readDensity(): "comfortable" | "compact" {
  try {
    return localStorage.getItem(APP_STORAGE_KEYS.gridDensity) === "compact"
      ? "compact"
      : "comfortable";
  } catch {
    return "comfortable";
  }
}

export default function AppCollection() {
  const t = useT();
  const count = useCount();
  const { money } = usePrefs();
  const { isAuthenticated, loading } = useAuth();
  const { items: pending } = usePending();
  const utils = trpc.useUtils();
  const list = trpc.binder.list.useQuery(undefined, { enabled: isAuthenticated });
  const update = trpc.binder.update.useMutation({
    onSuccess: () => {
      utils.binder.list.invalidate();
      utils.market.portfolio.invalidate();
    },
  });
  const remove = trpc.binder.remove.useMutation({
    onSuccess: () => {
      utils.binder.list.invalidate();
      utils.market.portfolio.invalidate();
      toast.success(t("Removed from collection"));
    },
  });

  const [q, setQ] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [condFilter, setCondFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [density, setDensity] = useState<"comfortable" | "compact">(readDensity);
  const [selected, setSelected] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    const saved: Row[] = (list.data ?? []).map(r => ({
      id: r.id,
      cardId: r.cardId,
      cardName: r.cardName,
      setName: r.setName,
      setId: r.setId,
      imageUrl: r.imageUrl,
      rarity: r.rarity,
      quantity: r.quantity,
      condition: r.condition as CardCondition,
      variant: isCardVariant(r.variant) ? r.variant : "normal",
      priceUsd: r.priceUsd == null ? null : Number(r.priceUsd),
      purchasePriceUsd:
        r.purchasePriceUsd == null ? null : Number(r.purchasePriceUsd),
      pending: false,
    }));
    const local: Row[] = pending.map(p => ({
      id: p.localId,
      cardId: p.cardId,
      cardName: p.cardName,
      setName: p.setName ?? null,
      setId: p.setId ?? null,
      imageUrl: p.imageUrl ?? null,
      rarity: p.rarity ?? null,
      quantity: p.quantity,
      condition: p.condition,
      variant: p.variant,
      priceUsd: p.priceUsd ?? null,
      purchasePriceUsd: p.purchasePriceUsd ?? null,
      pending: true,
    }));
    return [...local, ...saved];
  }, [list.data, pending]);

  const sets = useMemo(
    () =>
      Array.from(
        new Set(rows.map(r => r.setName).filter((s): s is string => !!s))
      ).sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter(
      r =>
        (!needle || r.cardName.toLowerCase().includes(needle)) &&
        (!setFilter || r.setName === setFilter) &&
        (!condFilter || r.condition === condFilter)
    );
    if (sort === "value") {
      return filtered.sort(
        (a, b) => (b.priceUsd ?? 0) * b.quantity - (a.priceUsd ?? 0) * a.quantity
      );
    }
    if (sort === "name") {
      return filtered.sort((a, b) => a.cardName.localeCompare(b.cardName));
    }
    return filtered;
  }, [rows, q, setFilter, condFilter, sort]);

  const total = rows.reduce((sum, r) => sum + (r.priceUsd ?? 0) * r.quantity, 0);
  const cardCount = rows.reduce((sum, r) => sum + r.quantity, 0);

  function toggleDensity() {
    const next = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    try {
      localStorage.setItem(APP_STORAGE_KEYS.gridDensity, next);
    } catch {
      // ignore
    }
  }

  const showSignIn = !loading && !isAuthenticated && rows.length === 0;

  return (
    <div className="app-page">
      <AppHeader
        title={t("Collection")}
        subtitle={rows.length ? `${count(cardCount, "card", "cards")} · ${money(total)}` : undefined}
        right={
          <button
            type="button"
            onClick={toggleDensity}
            aria-label={t("Sort")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground"
          >
            {density === "compact" ? (
              <Grid2X2 className="h-4 w-4" aria-hidden />
            ) : (
              <Grid3X3 className="h-4 w-4" aria-hidden />
            )}
          </button>
        }
      />

      {showSignIn ? (
        <SignInCard
          title={t("Sign in to see your collection")}
          body={t("Your cards sync across devices once you sign in.")}
          next="/app/collection"
        />
      ) : rows.length === 0 && !list.isLoading ? (
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
      ) : (
        <>
          <div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-secondary px-3">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t("Search your cards")}
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <select
              value={setFilter}
              onChange={e => setSetFilter(e.target.value)}
              className="h-9 shrink-0 rounded-full border border-border bg-secondary px-3 text-sm"
              aria-label={t("All sets")}
            >
              <option value="">{t("All sets")}</option>
              {sets.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={condFilter}
              onChange={e => setCondFilter(e.target.value)}
              className="h-9 shrink-0 rounded-full border border-border bg-secondary px-3 text-sm"
              aria-label={t("All conditions")}
            >
              <option value="">{t("All conditions")}</option>
              {["M", "NM", "SP", "MP", "HP", "D"].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="h-9 shrink-0 rounded-full border border-border bg-secondary px-3 text-sm"
              aria-label={t("Sort")}
            >
              <option value="newest">{t("Newest")}</option>
              <option value="value">{t("Highest value")}</option>
              <option value="name">{t("Name")}</option>
            </select>
          </div>

          {!isAuthenticated && pending.length > 0 && (
            <div className="mb-4">
              <SignInCard
                title={count(pending.length, "card waiting to be saved", "cards waiting to be saved")}
                body={t("Create a free account to keep them.")}
                cta={t("Save my cards")}
                next="/app/collection"
              />
            </div>
          )}

          <div
            className={`grid gap-3 ${
              density === "compact" ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            {visible.map(row => (
              <CardTile
                key={row.id}
                name={row.cardName}
                imageUrl={row.imageUrl}
                setName={row.setName}
                priceUsd={row.priceUsd}
                variant={row.variant}
                condition={row.condition}
                quantity={row.quantity}
                compact={density === "compact"}
                badge={
                  row.pending ? (
                    <span className="rounded-md bg-[var(--app-gold)] px-1.5 py-0.5 text-[10px] font-bold text-black">
                      {t("On this phone")}
                    </span>
                  ) : undefined
                }
                onClick={() => setSelected(row)}
              />
            ))}
          </div>
        </>
      )}

      <Drawer open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DrawerContent className="app-dark border-border bg-background">
          {selected && (
            <div className="overflow-y-auto px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-2">
              <DrawerTitle className="text-lg font-extrabold">{selected.cardName}</DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                {selected.setName}
              </DrawerDescription>
              <div className="mt-3 flex gap-3">
                {selected.imageUrl && (
                  <img
                    src={selected.imageUrl}
                    alt=""
                    className="h-36 w-[104px] rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{t("Market")}</p>
                    <Money usd={selected.priceUsd} dual size="lg" className="app-gold" />
                  </div>
                  {selected.purchasePriceUsd != null && (
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("Paid")}</p>
                      <Money usd={selected.purchasePriceUsd} size="sm" />
                    </div>
                  )}
                </div>
              </div>

              {!selected.pending && (
                <>
                  <section className="mt-5">
                    <h3 className="mb-2 text-sm font-bold">{t("Condition")}</h3>
                    <ConditionPicker
                      value={selected.condition}
                      onChange={condition => {
                        setSelected({ ...selected, condition });
                        update.mutate({ id: Number(selected.id), condition });
                      }}
                    />
                  </section>
                  <section className="mt-5 flex items-center justify-between">
                    <h3 className="text-sm font-bold">{t("Quantity")}</h3>
                    <Stepper
                      value={selected.quantity}
                      onChange={quantity => {
                        setSelected({ ...selected, quantity });
                        update.mutate({ id: Number(selected.id), quantity });
                      }}
                    />
                  </section>
                </>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2">
                <Link
                  href={`/cards/${selected.cardId}`}
                  className="flex h-11 items-center justify-center rounded-xl border border-border bg-secondary text-sm font-bold"
                >
                  {t("Open card page")}
                </Link>
                <Link
                  href={`/sell-card?card=${encodeURIComponent(selected.cardId)}`}
                  className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
                >
                  {t("Sell this card")}
                </Link>
              </div>
              {!selected.pending && (
                <button
                  type="button"
                  onClick={() => {
                    remove.mutate({ id: Number(selected.id) });
                    setSelected(null);
                  }}
                  className="mt-3 h-11 w-full rounded-xl text-sm font-semibold text-[var(--app-down)]"
                >
                  {t("Remove")}
                </button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
