import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import { Swords, TrendingUp, Trophy } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

const FORMAT_OPTIONS = [
  { value: "TEF-CRI", label: "Standard (TEF–CRI)" },
  { value: "BRS-CRI", label: "Standard (BRS–CRI)" },
  { value: "expanded", label: "Expanded" },
];

const RANK_COLORS = ["oklch(0.78 0.18 85)", "oklch(0.75 0.05 260)", "oklch(0.60 0.15 40)"];

export default function Metagame() {
  usePageMeta("Metagame", "Pokémon TCG metagame analysis — top decks, usage stats and matchups.");
  const { data: decks, isLoading } = trpc.metagame.topDecks.useQuery({ format: "TEF-CRI" });

  const top10 = decks?.slice(0, 10) ?? [];
  const top5 = decks?.slice(0, 5) ?? [];
  const otherShare = decks ? 100 - decks.slice(0, 5).reduce((s, d) => s + d.sharePercent, 0) : 0;

  const pieData = [
    ...top5.map((d) => ({ name: d.name, value: parseFloat(d.sharePercent.toFixed(1)) })),
    { name: "Other", value: parseFloat(otherShare.toFixed(1)) },
  ];

  const PIE_COLORS = [
    "oklch(0.78 0.18 85)",
    "oklch(0.65 0.20 330)",
    "oklch(0.60 0.18 230)",
    "oklch(0.70 0.18 145)",
    "oklch(0.65 0.22 35)",
    "oklch(0.50 0.02 260)",
  ];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[oklch(0.78_0.18_85/0.1)] flex items-center justify-center">
            <Swords className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Metagame</h1>
        </div>
        <p className="text-muted-foreground">
          Top competitive decks ranked by tournament usage — Standard format (TEF–CRI)
        </p>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Top 10 Decks by Usage</h3>
          </div>
          {isLoading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.02 260)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "oklch(0.75 0.01 260)", fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.018 260)", border: "1px solid oklch(0.22 0.02 260)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Usage"]}
                />
                <Bar dataKey="sharePercent" radius={[0, 4, 4, 0]}>
                  {top10.map((_, i) => (
                    <Cell key={i} fill={i < 3 ? RANK_COLORS[i] : "oklch(0.28 0.02 260)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Meta Share</h3>
          </div>
          {isLoading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={80} dataKey="value" stroke="none">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(v) => <span style={{ color: "oklch(0.75 0.01 260)", fontSize: "11px" }}>{v}</span>}
                />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.018 260)", border: "1px solid oklch(0.22 0.02 260)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v}%`, "Share"]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Full Rankings Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Full Rankings</h3>
          <span className="text-xs text-muted-foreground">Based on recent tournament results</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-8 h-4 bg-muted rounded" />
                <div className="w-12 h-12 bg-muted rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                  <div className="h-2.5 bg-muted rounded w-1/4" />
                </div>
                <div className="w-16 h-4 bg-muted rounded" />
                <div className="w-32 h-2 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {decks?.map((deck) => (
              <div key={deck.slug} className="px-6 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
                {/* Rank */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  deck.rank === 1 && "bg-[oklch(0.78_0.18_85)] text-[oklch(0.12_0.015_260)]",
                  deck.rank === 2 && "bg-[oklch(0.75_0.05_260)] text-[oklch(0.12_0.015_260)]",
                  deck.rank === 3 && "bg-[oklch(0.60_0.15_40)] text-white",
                  deck.rank > 3 && "bg-muted text-muted-foreground"
                )}>
                  {deck.rank}
                </div>

                {/* Image */}
                {deck.imageUrl ? (
                  <img src={deck.imageUrl} alt={deck.name} className="w-12 h-12 rounded-lg object-contain bg-muted border border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Swords className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                {/* Name & finish */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{deck.name}</p>
                  {deck.topFinish && (
                    <p className="text-xs text-muted-foreground truncate">{deck.topFinish}</p>
                  )}
                </div>

                {/* Points */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-bold text-foreground">{deck.points}</p>
                  <p className="text-[10px] text-muted-foreground">pts</p>
                </div>

                {/* Usage bar */}
                <div className="w-32 shrink-0 hidden md:block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary">{deck.sharePercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(deck.sharePercent * 2, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        Data sourced from recent Regionals, Internationals, and Special Events. Updated regularly.
      </p>
    </div>
  );
}
