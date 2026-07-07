import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { Link } from "wouter";

interface PokéCardProps {
  id: string;
  name: string;
  imageUrl: string;
  setName?: string;
  rarity?: string;
  types?: string[];
  price?: number | null;
  isSpecialRare?: boolean;
  className?: string;
  onAddToBinder?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  Fire: "bg-[oklch(0.65_0.22_35)]",
  Water: "bg-[oklch(0.60_0.18_230)]",
  Grass: "bg-[oklch(0.60_0.18_145)]",
  Lightning: "bg-[oklch(0.80_0.20_90)] text-black",
  Psychic: "bg-[oklch(0.65_0.20_330)]",
  Fighting: "bg-[oklch(0.55_0.15_40)]",
  Darkness: "bg-[oklch(0.35_0.08_260)]",
  Metal: "bg-[oklch(0.65_0.05_220)] text-black",
  Dragon: "bg-[oklch(0.55_0.20_270)]",
  Colorless: "bg-[oklch(0.50_0.02_260)]",
  Fairy: "bg-[oklch(0.70_0.15_350)]",
};

export default function PokéCard({
  id,
  name,
  imageUrl,
  setName,
  rarity,
  types,
  price,
  isSpecialRare,
  className,
  onAddToBinder,
}: PokéCardProps) {
  return (
    <Link href={`/cards/${id}`}>
      <div
        className={cn(
          "group relative bg-card rounded-xl overflow-hidden border border-border",
          "transition-all duration-200 ease-out cursor-pointer",
          "hover:-translate-y-1.5 hover:shadow-[0_8px_32px_oklch(0_0_0/0.5)]",
          isSpecialRare && "border-[oklch(0.78_0.18_85/0.4)] hover:border-[oklch(0.78_0.18_85/0.8)] hover:shadow-[0_8px_32px_oklch(0.78_0.18_85/0.2)]",
          "card-shine",
          className
        )}
      >
        {/* Special rare glow */}
        {isSpecialRare && (
          <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.78_0.18_85/0.05)] to-transparent pointer-events-none z-10" />
        )}

        {/* Image */}
        <div className="relative aspect-[3/4.2] bg-muted overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Special rare badge */}
          {isSpecialRare && (
            <div className="absolute top-2 right-2 z-20">
              <div className="flex items-center gap-0.5 bg-[oklch(0.78_0.18_85)] text-[oklch(0.12_0.015_260)] text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                <Star className="w-2.5 h-2.5 fill-current" />
                <span>RARE</span>
              </div>
            </div>
          )}

          {/* Type badges */}
          {types && types.length > 0 && (
            <div className="absolute top-2 left-2 z-20 flex gap-1">
              {types.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow",
                    TYPE_COLORS[type] ?? "bg-muted"
                  )}
                >
                  {type.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {/* Add to binder overlay */}
          {onAddToBinder && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-30">
              <button
                onClick={(e) => { e.preventDefault(); onAddToBinder(); }}
                className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary/90 transition-colors"
              >
                + Add to Binder
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">{name}</p>
          {setName && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{setName}</p>
          )}
          {price != null && price > 0 && (
            <p className={cn(
              "text-xs font-bold mt-1.5",
              price >= 50 ? "text-[oklch(0.78_0.18_85)]" : price >= 10 ? "text-[oklch(0.75_0.15_145)]" : "text-muted-foreground"
            )}>
              ${price.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// Skeleton variant
export function PokéCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border animate-pulse">
      <div className="aspect-[3/4.2] bg-muted" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-2.5 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/4 mt-1" />
      </div>
    </div>
  );
}
