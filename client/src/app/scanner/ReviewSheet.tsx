import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  isCardVariant,
  type CardCondition,
  type CardVariant,
} from "@shared/app";
import { useT } from "../i18n";
import { usePrefs } from "../prefs";
import { Money } from "../components/Money";
import { ConditionPicker, Stepper, VariantPicker } from "../components/pickers";
import { addPending } from "../pending";
import { track } from "../analytics";
import type { ScanMatch, ScanResult } from "./identify";

export type ReviewDraft = {
  matchId: string;
  variant: CardVariant;
  condition: CardCondition;
  quantity: number;
  paid: string;
};

export function defaultDraft(result: ScanResult): ReviewDraft | null {
  const best = result.matches[0];
  if (!best) return null;
  const v = best.suggestedVariant;
  return {
    matchId: best.id,
    variant: isCardVariant(v) ? v : result.analysis.normalizedVariant,
    condition: "NM",
    quantity: 1,
    paid: "",
  };
}

function matchLabel(score: number, t: (s: string) => string) {
  if (score >= 80) return t("Strong match");
  if (score >= 55) return t("Likely match");
  return t("Check carefully");
}

export function priceFor(match: ScanMatch, variant: CardVariant) {
  const exact = match.variantPrices[variant];
  if (exact != null) return { usd: exact, exact: true };
  return { usd: match.suggestedPriceUsd ?? match.marketPriceUsd, exact: false };
}

/**
 * Bottom sheet to confirm one scan: pick the right card among the catalog
 * matches, the printed variant (with its price), condition, quantity and
 * what was paid. Saves to the binder when signed in, else to the device.
 */
export function ReviewSheet({
  open,
  onOpenChange,
  result,
  draft,
  onDraftChange,
  onCollected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ScanResult | null;
  draft: ReviewDraft | null;
  onDraftChange: (draft: ReviewDraft) => void;
  onCollected: () => void;
}) {
  const t = useT();
  const { currency, fx } = usePrefs();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const add = trpc.binder.add.useMutation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && result) track("review_opened", { matches: result.matches.length });
  }, [open, result]);

  if (!result || !draft) return null;
  const match = result.matches.find(m => m.id === draft.matchId) ?? result.matches[0];
  if (!match) return null;
  const price = priceFor(match, draft.variant);

  // "Paid" is typed in the display currency; store it in USD.
  const paidUsd = (() => {
    const n = Number(draft.paid.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    const rate = fx?.rates[currency] ?? (currency === "BRL" ? 5.5 : 1);
    return Math.round((n / rate) * 100) / 100;
  })();

  async function collect() {
    if (!match) return;
    setSaving(true);
    const payload = {
      cardId: match.id,
      cardName: match.name,
      setId: match.set.id,
      setName: match.set.name,
      imageUrl: match.images.small,
      rarity: match.rarity ?? undefined,
      quantity: draft!.quantity,
      condition: draft!.condition,
      variant: draft!.variant,
      language: result!.analysis.languageCode ?? undefined,
      priceUsd: price.usd ?? null,
      purchasePriceUsd: paidUsd,
    };
    try {
      if (isAuthenticated) {
        await add.mutateAsync({ ...payload, acquisitionSource: "pull" });
        utils.binder.list.invalidate();
        utils.market.portfolio.invalidate();
        toast.success(t("Added to collection"));
      } else {
        addPending(payload);
        toast.success(t("Added to collection"), {
          description: t("Saved on this phone until you sign in."),
        });
      }
      track("card_collected", {
        signedIn: isAuthenticated,
        variant: draft!.variant,
        priced: price.usd != null,
      });
      onCollected();
      onOpenChange(false);
    } catch {
      toast.error(t("Retry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="app-dark max-h-[92vh] border-border bg-background">
        <div className="overflow-y-auto px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-2">
          <DrawerTitle className="sr-only">{t("Review")}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {matchLabel(match.matchScore, t)}
          </DrawerDescription>

          <div className="flex gap-3">
            <img
              src={match.images.small}
              alt={match.name}
              className="h-32 w-[92px] shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold leading-tight">{match.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {match.set.name} · #{match.number}
                {match.set.printedTotal ? `/${match.set.printedTotal}` : ""}
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  match.matchScore >= 55 ? "app-up" : "app-gold"
                }`}
              >
                {matchLabel(match.matchScore, t)}
              </p>
              <div className="mt-2">
                <p className="text-[11px] text-muted-foreground">
                  {price.exact ? t("Price for this variant") : t("Market")}
                </p>
                <Money usd={price.usd} dual size="lg" className="app-gold" />
              </div>
            </div>
          </div>

          {result.matches.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t("Not this card")}?
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {result.matches.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      const v = m.suggestedVariant;
                      onDraftChange({
                        ...draft,
                        matchId: m.id,
                        variant: isCardVariant(v) ? v : draft.variant,
                      });
                    }}
                    aria-pressed={m.id === match.id}
                    className={`shrink-0 overflow-hidden rounded-lg border-2 ${
                      m.id === match.id ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img
                      src={m.images.small}
                      alt={`${m.name} ${m.set.name}`}
                      className="h-[76px] w-[55px] object-cover"
                    />
                  </button>
                ))}
                <Link
                  href={`/cards?q=${encodeURIComponent(
                    result.analysis.name ?? match.name
                  )}`}
                  className="flex h-[76px] w-[55px] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground"
                >
                  <ExternalLink className="mb-1 h-4 w-4" aria-hidden />
                  {t("Search")}
                </Link>
              </div>
            </div>
          )}

          <section className="mt-5">
            <h3 className="mb-2 text-sm font-bold">{t("Variant")}</h3>
            <VariantPicker
              value={draft.variant}
              onChange={variant => onDraftChange({ ...draft, variant })}
              prices={match.variantPrices}
            />
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-sm font-bold">{t("Condition")}</h3>
            <ConditionPicker
              value={draft.condition}
              onChange={condition => onDraftChange({ ...draft, condition })}
            />
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <h3 className="mb-2 text-sm font-bold">{t("Quantity")}</h3>
              <Stepper
                value={draft.quantity}
                onChange={quantity => onDraftChange({ ...draft, quantity })}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">{t("Paid (optional)")}</h3>
              <div className="flex h-11 items-center rounded-xl border border-border bg-secondary px-3">
                <span className="mr-2 text-sm text-muted-foreground">
                  {currency === "USD" ? "US$" : "R$"}
                </span>
                <input
                  inputMode="decimal"
                  value={draft.paid}
                  onChange={e => onDraftChange({ ...draft, paid: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-transparent text-base font-semibold outline-none"
                />
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={collect}
            disabled={saving}
            className="mt-6 flex h-13 min-h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? t("Loading…") : t("Add to collection")}
          </button>
          {!isAuthenticated && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("Saved on this phone until you sign in.")}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
