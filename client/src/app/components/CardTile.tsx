import { Money } from "./Money";
import { useT } from "../i18n";
import { VARIANT_LABEL } from "./pickers";
import type { CardVariant } from "@shared/app";

/**
 * One card in a grid. The image is the identity; the price is the point.
 * Density "comfortable" shows two per row, "compact" three — the HoloDex
 * reviews asked for exactly this toggle.
 */
export function CardTile({
  name,
  imageUrl,
  setName,
  number,
  priceUsd,
  variant,
  condition,
  quantity,
  badge,
  onClick,
  compact = false,
}: {
  name: string;
  imageUrl?: string | null;
  setName?: string | null;
  number?: string | null;
  priceUsd?: number | null;
  variant?: CardVariant | string | null;
  condition?: string | null;
  quantity?: number;
  badge?: React.ReactNode;
  onClick?: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const variantLabel =
    variant && variant in VARIANT_LABEL
      ? t(VARIANT_LABEL[variant as CardVariant])
      : null;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="app-card-shine group relative flex w-full flex-col overflow-hidden rounded-xl border border-border text-left active:scale-[0.98] transition-transform"
    >
      <div className="relative aspect-[63/88] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {name}
          </div>
        )}
        {quantity != null && quantity > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-bold">
            ×{quantity}
          </span>
        )}
        {badge && <span className="absolute left-1.5 top-1.5">{badge}</span>}
      </div>
      {!compact && (
        <div className="space-y-0.5 p-2">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[setName, number ? `#${number}` : null].filter(Boolean).join(" · ")}
          </p>
          <div className="flex items-baseline justify-between gap-2 pt-0.5">
            <Money usd={priceUsd} size="sm" className="font-bold" />
            <span className="truncate text-[11px] text-muted-foreground">
              {[variantLabel, condition].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      )}
      {compact && (
        <div className="px-1.5 py-1">
          <Money usd={priceUsd} size="sm" className="text-xs font-bold" />
        </div>
      )}
    </Wrapper>
  );
}
