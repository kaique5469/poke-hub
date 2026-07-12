import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Crown, Flame, HelpCircle, Loader2, Medal, RotateCcw, Search,
  Sparkles, Snowflake, Sun, Trophy, XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

// Warmth tier palette (spec §5)
const TIER: Record<string, { bg: string; bar: string; text: string; icon: ReactNode; label: string }> = {
  win:    { bg: "#ecfdf5", bar: "#10B981", text: "#065f46", icon: <Crown size={18} />, label: "Exact match" },
  green:  { bg: "#ecfdf5", bar: "#10B981", text: "#065f46", icon: <Sparkles size={18} />, label: "Very hot" },
  yellow: { bg: "#fffbeb", bar: "#F59E0B", text: "#92400e", icon: <Sun size={18} />, label: "Warm" },
  blue:   { bg: "#eff6ff", bar: "#3B82F6", text: "#1e40af", icon: <Snowflake size={18} />, label: "Cool" },
  red:    { bg: "#fef2f2", bar: "#EF4444", text: "#991b1b", icon: <XCircle size={18} />, label: "Cold" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Small comparison chip shown under each feedback card. */
function HintChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border"
      style={ok
        ? { background: "#d1fae5", borderColor: "#10B981", color: "#065f46" }
        : { background: "#f3f4f6", borderColor: "#e5e7eb", color: "#9ca3af" }}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export default function GuessGame() {
  usePageMeta("Guess the Pokémon", "Guess the hidden Pokémon, earn points and climb the TCG Arena leaderboard.");
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = trpc.game.current.useQuery(undefined, { enabled: isAuthenticated });
  const statsQ = trpc.game.myStats.useQuery(undefined, { enabled: isAuthenticated });
  const boardQ = trpc.game.leaderboard.useQuery({ limit: 10 });

  const startM = trpc.game.start.useMutation({
    onSuccess: () => { setShowModal(false); setQ(""); utils.game.current.invalidate(); },
  });
  const guessM = trpc.game.guess.useMutation({
    onSuccess: (res) => {
      setQ("");
      utils.game.current.invalidate();
      if (res.status !== "active") {
        setShowModal(true);
        utils.game.myStats.invalidate();
        utils.game.leaderboard.invalidate();
      }
    },
  });

  const round = currentQ.data;
  const active = round?.status === "active";
  const lastResult = guessM.data;

  // Suggestions from the existing Pokédex index (fuzzy prefix search)
  const sugQ = trpc.pokemon.list.useQuery(
    { q, page: 1, pageSize: 8 },
    { enabled: q.trim().length >= 2 && !!active },
  );
  const suggestions = (sugQ.data?.items ?? []) as Array<{ id: number; name: string; sprite: string; types: string[] }>;

  useEffect(() => setHighlight(0), [q]);

  const submitGuess = (pokemonId: number) => {
    if (!round || !active || guessM.isPending) return;
    guessM.mutate({ roundId: round.roundId, pokemonId });
  };

  const attemptsRemaining = round?.attemptsRemaining ?? 15;
  const maxAttempts = round?.maxAttempts ?? 15;
  const pct = (attemptsRemaining / maxAttempts) * 100;
  const barColor = pct > 60 ? "#10B981" : pct > 30 ? "#F59E0B" : "#EF4444";
  const potential = attemptsRemaining * 10;

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg,#7C3AED,#FF2E9A)" }}>
            <HelpCircle size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>Guess the Pokémon</h1>
            <p className="text-sm text-gray-500">Find the hidden Pokémon in {maxAttempts} tries. Warmer colors = closer!</p>
          </div>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-xl bg-violet-50 border border-violet-200">
              <div className="text-[11px] font-bold text-violet-500 uppercase">Points this round</div>
              <div className="text-xl font-black text-violet-700">{active ? potential : (lastResult?.roundScore ?? 0)}</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-[11px] font-bold text-amber-500 uppercase">Total points</div>
              <div className="text-xl font-black text-amber-600">{statsQ.data?.totalPoints ?? 0}</div>
            </div>
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="rounded-2xl border bg-white p-10 text-center max-w-lg mx-auto">
          <Trophy size={40} className="mx-auto mb-3 text-violet-500" />
          <h2 className="text-xl font-bold mb-2">Sign in to play</h2>
          <p className="text-sm text-gray-500 mb-5">Your points are saved to your account and rank you on the arena leaderboard.</p>
          <Link href="/login"><Button className="rounded-full font-bold px-6" style={{ background: "#7C3AED" }}>Sign In</Button></Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Game column ── */}
          <div className="lg:col-span-2">
            {!round || round.status !== "active" ? (
              <div className="rounded-2xl border bg-white p-10 text-center">
                <Sparkles size={40} className="mx-auto mb-3 text-violet-500" />
                <h2 className="text-xl font-bold mb-2">Ready for a new round?</h2>
                <p className="text-sm text-gray-500 mb-5">A random Pokémon from all {""}9 generations will be chosen. You have {maxAttempts} guesses.</p>
                <Button onClick={() => startM.mutate()} disabled={startM.isPending} className="rounded-full font-bold px-8 text-white" style={{ background: "#7C3AED" }}>
                  {startM.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Flame size={16} className="mr-2" />} Start Game
                </Button>
              </div>
            ) : (
              <>
                {/* Attempts bar */}
                <div className="rounded-2xl border bg-white p-4 mb-4">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-500 uppercase">Attempts remaining</span>
                    <span style={{ color: barColor }}>{attemptsRemaining} / {maxAttempts}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>

                {/* Guess input (sticky) */}
                <div className="sticky top-20 z-20 mb-4">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={inputRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
                        else if (e.key === "Enter" && suggestions[highlight]) submitGuess(suggestions[highlight].id);
                      }}
                      placeholder="Type or search Pokémon name…"
                      disabled={guessM.isPending}
                      className="w-full rounded-full border-2 border-violet-200 focus:border-violet-500 outline-none bg-white py-3 pl-11 pr-4 text-sm font-medium shadow-sm"
                    />
                    {guessM.isPending && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-violet-500" />}
                    {q.trim().length >= 2 && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl overflow-hidden z-30">
                        {suggestions.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => submitGuess(p.id)}
                            onMouseEnter={() => setHighlight(i)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === highlight ? "bg-violet-50" : ""}`}
                          >
                            <img src={p.sprite} alt="" className="w-9 h-9 object-contain" loading="lazy" />
                            <span className="font-semibold text-sm">{cap(p.name)}</span>
                            <span className="ml-auto text-[11px] text-gray-400">#{p.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {q.trim().length >= 2 && !sugQ.isFetching && suggestions.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl px-4 py-3 text-sm text-gray-500 z-30">
                        Pokémon not found, try another.
                      </div>
                    )}
                  </div>
                  {guessM.error && <p className="text-xs text-red-500 font-medium mt-2 px-4">{guessM.error.message}</p>}
                </div>

                {/* Feedback stack (newest first, persists) */}
                <div className="space-y-2.5">
                  {(round.guesses ?? []).map((g: any, idx: number) => {
                    const t = TIER[g.tier] ?? TIER.red;
                    return (
                      <div
                        key={`${g.guess.id}-${g.attempt}`}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${idx === 0 ? "animate-fade-in" : ""}`}
                        style={{ background: t.bg, borderLeft: `4px solid ${t.bar}` }}
                      >
                        <span style={{ color: t.bar }}>{t.icon}</span>
                        <img src={g.guess.sprite} alt={g.guess.name} className="w-12 h-12 object-contain" loading="lazy" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm" style={{ color: t.text }}>{g.guess.name}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white" style={{ background: t.bar }}>{t.label}</span>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: t.text }}>{g.message}</p>
                          <p className="text-xs text-gray-500">{g.detail}</p>
                          {g.comparisons && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <HintChip ok={g.comparisons.family} label="Evolution line" />
                              <HintChip
                                ok={!!g.comparisons.sharedType}
                                label={g.comparisons.sharedType
                                  ? `${cap(g.comparisons.sharedType)} energy`
                                  : `${(g.guess.types ?? []).map(cap).join("/") || "?"} energy`}
                              />
                              <HintChip ok={g.comparisons.generation} label={`Gen ${g.guess.generation}`} />
                              <HintChip ok={g.comparisons.region} label={g.guess.region} />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium shrink-0">Attempt {g.attempt} / {maxAttempts}</span>
                      </div>
                    );
                  })}
                  {(round.guesses ?? []).length === 0 && (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">
                      Make your first guess — feedback cards will stack here.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar: stats + leaderboard ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-3 flex items-center gap-2"><Medal size={16} className="text-violet-500" /> Your Stats</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-lg font-black text-violet-600">{statsQ.data?.totalPoints ?? 0}</div><div className="text-[11px] text-gray-500 font-semibold">Total Points</div></div>
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-lg font-black text-emerald-600">{statsQ.data?.wins ?? 0}</div><div className="text-[11px] text-gray-500 font-semibold">Wins</div></div>
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-lg font-black text-amber-500">{statsQ.data?.streak ?? 0}</div><div className="text-[11px] text-gray-500 font-semibold">Win Streak</div></div>
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-lg font-black text-gray-700">{statsQ.data?.bestAttempts ?? "—"}</div><div className="text-[11px] text-gray-500 font-semibold">Best (attempts)</div></div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-3 flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Leaderboard</h3>
              {(boardQ.data ?? []).length === 0 && <p className="text-sm text-gray-400">No players yet — be the first!</p>}
              <div className="space-y-1.5">
                {(boardQ.data ?? []).map((row: any, i: number) => (
                  <div key={row.userId} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${row.name === user?.name ? "bg-violet-50" : ""}`}>
                    <span className={`w-6 text-center font-black text-sm ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>{i + 1}</span>
                    {row.avatarUrl
                      ? <img src={row.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600">{(row.name ?? "?").charAt(0).toUpperCase()}</div>}
                    <span className="text-sm font-semibold truncate flex-1">{row.name ?? row.username ?? "Trainer"}</span>
                    <span className="text-sm font-black text-violet-600">{row.totalPoints}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 text-xs text-gray-500 space-y-1.5">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">How warmth works</h3>
              <p><span className="font-bold" style={{ color: "#10B981" }}>● Green</span> — same evolutionary line (hottest hint)</p>
              <p><span className="font-bold" style={{ color: "#F59E0B" }}>● Yellow</span> — same energy type or generation</p>
              <p><span className="font-bold" style={{ color: "#3B82F6" }}>● Blue</span> — close, neighboring generation</p>
              <p><span className="font-bold" style={{ color: "#EF4444" }}>● Red</span> — completely different</p>
              <p className="pt-1">Score: 10 pts per attempt left (max 150). Points accumulate forever.</p>
            </div>
          </div>
        </div>
      )}

      {/* Game-over modal */}
      {showModal && lastResult?.reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-x-0 top-0 h-24 opacity-20" style={{ background: lastResult.status === "won" ? "linear-gradient(135deg,#10B981,#7C3AED)" : "linear-gradient(135deg,#EF4444,#7C3AED)" }} />
            <div className={`relative ${lastResult.status === "won" ? "animate-bounce" : ""}`}>
              <img src={lastResult.reveal.sprite} alt={lastResult.reveal.name} className="w-40 h-40 object-contain mx-auto drop-shadow-xl" />
            </div>
            <h2 className="text-2xl font-black mt-2" style={{ fontFamily: "var(--font-display)" }}>
              {lastResult.status === "won" ? "You got it!" : "Out of attempts!"}
            </h2>
            <p className="text-gray-500 text-sm mb-1">The Pokémon was <span className="font-bold text-gray-800">{lastResult.reveal.name}</span></p>
            <p className="text-xs text-gray-400 mb-4">{lastResult.reveal.types.map(cap).join(" / ")} · Gen {lastResult.reveal.generation} · {lastResult.reveal.region}</p>
            <div className="flex justify-center gap-3 mb-6">
              <div className="rounded-xl bg-gray-50 px-4 py-2"><div className="text-lg font-black">{15 - (lastResult.attemptsRemaining ?? 0)} / 15</div><div className="text-[11px] text-gray-500 font-semibold">Attempts used</div></div>
              <div className="rounded-xl bg-violet-50 px-4 py-2"><div className="text-lg font-black text-violet-600">+{lastResult.roundScore}</div><div className="text-[11px] text-gray-500 font-semibold">Points earned</div></div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => startM.mutate()} disabled={startM.isPending} className="rounded-full font-bold text-white px-5" style={{ background: "#7C3AED" }}>
                <RotateCcw size={15} className="mr-2" /> Play Again
              </Button>
              <Link href="/marketplace"><Button variant="outline" className="rounded-full font-bold px-5">Back to Marketplace</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
