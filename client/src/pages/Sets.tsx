import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Layers } from "lucide-react";
import { Link } from "wouter";

export default function Sets() {
  usePageMeta("Sets", "Every Pokémon TCG set with release dates, card counts and symbols.");
  const { data, isLoading } = trpc.sets.list.useQuery();

  const seriesOrder = [
    "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Black & White",
    "HeartGold & SoulSilver", "Platinum", "Diamond & Pearl", "EX", "e-Card",
    "Neo", "Gym", "Base",
  ];

  const grouped = data?.grouped ?? {};
  const sortedSeries = [
    ...seriesOrder.filter((s) => grouped[s]),
    ...Object.keys(grouped).filter((s) => !seriesOrder.includes(s)).sort(),
  ];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2">TCG Sets</h1>
        <p className="text-muted-foreground">
          {data ? (
            <><span className="text-foreground font-semibold">{data.sets.length}</span> sets across all series</>
          ) : "Browse all Pokémon TCG sets"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-10">
          {Array.from({ length: 3 }).map((_, si) => (
            <div key={si}>
              <div className="h-6 bg-muted rounded w-48 mb-4 animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                    <div className="h-16 bg-muted rounded-lg mb-3" />
                    <div className="h-3 bg-muted rounded w-3/4 mb-1.5" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {sortedSeries.map((series) => (
            <div key={series}>
              <div className="flex items-center gap-3 mb-5">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-display text-xl font-bold text-foreground">{series}</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {grouped[series].length} sets
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {grouped[series].map((set) => (
                  <Link key={set.id} href={`/cards?set=${set.id}`}>
                    <div className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:-translate-y-1 hover:shadow-[0_8px_24px_oklch(0_0_0/0.3)] transition-all duration-200 cursor-pointer h-full flex flex-col">
                      {/* Set logo */}
                      <div className="h-14 flex items-center justify-center mb-3">
                        {set.images.logo ? (
                          <img
                            src={set.images.logo}
                            alt={set.name}
                            className="max-h-full max-w-full object-contain filter brightness-90 group-hover:brightness-110 transition-all"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Layers className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Set info */}
                      <div className="mt-auto">
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">{set.name}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {set.releaseDate?.split("/")[0] ?? ""}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {set.total} cards
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
