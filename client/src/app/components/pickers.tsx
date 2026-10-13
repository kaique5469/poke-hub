import {
  CARD_CONDITIONS,
  CARD_VARIANTS,
  type CardCondition,
  type CardVariant,
} from "@shared/app";
import { useT } from "../i18n";
import { usePrefs } from "../prefs";

export const VARIANT_LABEL: Record<CardVariant, string> = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse holo",
  "1stEditionHolofoil": "1st edition holo",
  "1stEditionNormal": "1st edition",
  promo: "Promo",
};

export const CONDITION_LABEL: Record<CardCondition, string> = {
  M: "Mint",
  NM: "Near mint",
  SP: "Slightly played",
  MP: "Moderately played",
  HP: "Heavily played",
  D: "Damaged",
};

function Chip({
  active,
  onClick,
  children,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-11 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40 ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-secondary text-secondary-foreground"
      }`}
    >
      <span className="font-semibold leading-tight">{children}</span>
      {hint && (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {hint}
        </span>
      )}
    </button>
  );
}

/**
 * Variant picker that shows the price per variant, so the person sees why
 * it matters (reverse vs holo can differ 10×). Variants without a known
 * price are still selectable: the row is stored, the price stays empty.
 */
export function VariantPicker({
  value,
  onChange,
  prices,
}: {
  value: CardVariant;
  onChange: (v: CardVariant) => void;
  prices?: Record<string, number | null>;
}) {
  const t = useT();
  const { money } = usePrefs();
  const known = prices ? Object.keys(prices) : [];
  // Variants the card has prices for first; the rest after.
  const ordered = [...CARD_VARIANTS].sort((a, b) => {
    const ka = known.includes(a) ? 0 : 1;
    const kb = known.includes(b) ? 0 : 1;
    return ka - kb;
  });
  return (
    <div className="grid grid-cols-2 gap-2">
      {ordered.map(v => {
        const price = prices?.[v];
        return (
          <Chip
            key={v}
            active={value === v}
            onClick={() => onChange(v)}
            hint={
              price != null
                ? money(price)
                : known.length > 0
                  ? t("No price for this variant yet")
                  : undefined
            }
          >
            {t(VARIANT_LABEL[v])}
          </Chip>
        );
      })}
    </div>
  );
}

export function ConditionPicker({
  value,
  onChange,
}: {
  value: CardCondition;
  onChange: (v: CardCondition) => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-3 gap-2">
      {CARD_CONDITIONS.map(c => (
        <Chip key={c} active={value === c} onClick={() => onChange(c)} hint={t(CONDITION_LABEL[c])}>
          {c}
        </Chip>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex h-11 items-center rounded-xl border border-border bg-secondary">
      <button
        type="button"
        className="h-full w-11 text-lg font-bold text-secondary-foreground disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="−1"
      >
        −
      </button>
      <span className="w-10 text-center text-base font-bold">{value}</span>
      <button
        type="button"
        className="h-full w-11 text-lg font-bold text-secondary-foreground disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="+1"
      >
        +
      </button>
    </div>
  );
}
