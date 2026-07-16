import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import { Calendar, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_STYLES: Record<string, string> = {
  international:
    "bg-[oklch(0.78_0.18_85/0.15)] text-[oklch(0.78_0.18_85)] border-[oklch(0.78_0.18_85/0.3)]",
  regional:
    "bg-[oklch(0.60_0.18_230/0.15)] text-[oklch(0.60_0.18_230)] border-[oklch(0.60_0.18_230/0.3)]",
  special:
    "bg-[oklch(0.65_0.20_330/0.15)] text-[oklch(0.65_0.20_330)] border-[oklch(0.65_0.20_330/0.3)]",
  worlds:
    "bg-[oklch(0.78_0.18_85/0.2)] text-[oklch(0.78_0.18_85)] border-[oklch(0.78_0.18_85/0.5)]",
  cl: "bg-[oklch(0.60_0.18_230/0.15)] text-[oklch(0.60_0.18_230)]",
};

const TYPE_LABELS: Record<string, string> = {
  international: "International",
  regional: "Regional",
  special: "Special",
  worlds: "🌍 Worlds",
  cl: "Champions League",
};

export default function Tournaments() {
  usePageMeta(
    "Tournaments",
    "Find Pokémon TCG tournaments and events near you."
  );
  const { data: completed, isLoading: completedLoading } =
    trpc.tournaments.completed.useQuery();
  const { data: upcoming, isLoading: upcomingLoading } =
    trpc.tournaments.upcoming.useQuery();

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[oklch(0.78_0.18_85/0.1)] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            Tournaments
          </h1>
        </div>
        <p className="text-muted-foreground">
          Cached event references with a direct path to the live source
        </p>
        <a
          href="https://limitlesstcg.com/tournaments"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-black text-primary hover:underline"
        >
          Verify current events at Limitless TCG ↗
        </a>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="bg-card border border-border mb-8">
          <TabsTrigger
            value="results"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Recent Results
          </TabsTrigger>
          <TabsTrigger
            value="upcoming"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Upcoming Events
          </TabsTrigger>
        </TabsList>

        {/* Results Tab */}
        <TabsContent value="results">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Tournament Results
              </h3>
              <span className="text-xs text-muted-foreground">
                Cached snapshot · verify before travel
              </span>
            </div>

            {completedLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="px-6 py-4 flex items-center gap-4 animate-pulse"
                  >
                    <div className="w-20 h-3.5 bg-muted rounded" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-muted rounded w-2/3" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                    <div className="w-16 h-6 bg-muted rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {completed?.map(t => (
                  <div
                    key={t.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-accent/20 transition-colors"
                  >
                    {/* Date */}
                    <div className="flex items-center gap-1.5 shrink-0 sm:w-28">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Name & location */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">
                          {t.name}
                        </p>
                        <span className="text-base">{t.countryFlag}</span>
                      </div>
                      {t.winner && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Winner:{" "}
                          <span className="text-foreground font-medium">
                            {t.winnerFlag} {t.winner}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Players */}
                    <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t.players.toLocaleString()} players
                      </span>
                    </div>

                    {/* Type badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase shrink-0",
                        TYPE_STYLES[t.type] ?? "bg-muted"
                      )}
                    >
                      {TYPE_LABELS[t.type] ?? t.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming">
          {upcomingLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-5 animate-pulse"
                >
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : upcoming && upcoming.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map(t => (
                <div
                  key={t.id}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-foreground text-sm leading-snug">
                      {t.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase shrink-0",
                        TYPE_STYLES[t.type] ?? "bg-muted"
                      )}
                    >
                      {TYPE_LABELS[t.type] ?? t.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(t.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                    {t.format}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No upcoming events announced yet
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
