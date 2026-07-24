import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  ChevronRight,
  Crown,
  Clock3,
  Crosshair,
  Dices,
  Flame,
  Gift,
  Globe2,
  Loader2,
  LockKeyhole,
  MapPin,
  Medal,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Snowflake,
  Star,
  Sun,
  Trophy,
  Zap,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

// Warmth tier palette (spec §5)
const TIER: Record<
  string,
  { bg: string; bar: string; text: string; icon: ReactNode; label: string }
> = {
  win: {
    bg: "#ecfdf5",
    bar: "#10B981",
    text: "#065f46",
    icon: <Crown size={18} />,
    label: "Exact match",
  },
  green: {
    bg: "#ecfdf5",
    bar: "#10B981",
    text: "#065f46",
    icon: <Sparkles size={18} />,
    label: "Very hot",
  },
  yellow: {
    bg: "#fffbeb",
    bar: "#F59E0B",
    text: "#92400e",
    icon: <Sun size={18} />,
    label: "Warm",
  },
  blue: {
    bg: "#eff6ff",
    bar: "#3B82F6",
    text: "#1e40af",
    icon: <Snowflake size={18} />,
    label: "Cool",
  },
  red: {
    bg: "#fef2f2",
    bar: "#EF4444",
    text: "#991b1b",
    icon: <XCircle size={18} />,
    label: "Cold",
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type GameDifficulty = "easy" | "medium" | "hard";

const MODES: Record<
  GameDifficulty,
  {
    label: string;
    subtitle: string;
    description: string;
    attempts: number;
    maxScore: number;
    accent: string;
    soft: string;
    border: string;
    icon: ReactNode;
  }
> = {
  easy: {
    label: "Easy",
    subtitle: "Fan favorites",
    description: "Famous Pokémon, starters and icons from every generation.",
    attempts: 15,
    maxScore: 120,
    accent: "#059669",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    icon: <Sprout size={21} />,
  },
  medium: {
    label: "Medium",
    subtitle: "Balanced challenge",
    description: "A much wider mix with fewer guesses and stronger rewards.",
    attempts: 12,
    maxScore: 180,
    accent: "#7C3AED",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    icon: <Brain size={21} />,
  },
  hard: {
    label: "Hard",
    subtitle: "Full National Dex",
    description: "Any Pokémon can appear with equal odds. No safe picks.",
    attempts: 9,
    maxScore: 270,
    accent: "#e11d48",
    soft: "#fff1f2",
    border: "#fecdd3",
    icon: <Dices size={21} />,
  },
};

/** Small comparison chip shown under each feedback card. */
function HintChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border"
      style={
        ok
          ? { background: "#d1fae5", borderColor: "#10B981", color: "#065f46" }
          : { background: "#f3f4f6", borderColor: "#e5e7eb", color: "#9ca3af" }
      }
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function WeeklyArenaBanner({ data }: { data: any }) {
  const competition = data?.competition;
  const endsAt = data?.endsAt ? new Date(data.endsAt) : null;
  const territory =
    competition?.eligibleCountry === "BR,US" ||
    competition?.eligibleCountry === "US,BR"
      ? "United States + Brazil"
      : competition?.eligibleCountry === "US"
        ? "United States"
        : competition?.eligibleCountry === "BR"
          ? "Brazil"
          : "United States + Brazil";

  return (
    <section className="relative mb-7 overflow-hidden rounded-[28px] border border-slate-700/70 bg-[#11182c] text-white shadow-[0_24px_70px_-35px_rgba(76,29,149,.8)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(139,92,246,.38),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(14,165,233,.2),transparent_36%)]" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-7 -top-10 h-40 w-40 rounded-full border border-white/10" />

      <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">
              <Trophy size={13} /> Weekly Arena
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-sky-100">
              <Globe2 size={13} /> {territory}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] ${
                competition
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  competition ? "bg-emerald-300" : "bg-slate-400"
                }`}
              />
              {competition ? "Prize round live" : "Practice ranking"}
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 shadow-[0_12px_32px_-12px_rgba(251,191,36,.9)] sm:flex">
              <Trophy size={27} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-violet-200">
                Play. Score. Take the top spot.
              </p>
              <h2 className="mt-1.5 text-2xl font-black leading-tight text-white sm:text-3xl">
                {competition?.prizeTitle ?? "Own this week's leaderboard"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {competition
                  ? competition.prizeDescription ||
                    "Finish first when the weekly ranking closes to become the eligible winner."
                  : "Every win builds your weekly score. Physical prizes appear only for rounds with published official rules and verified authorization."}
              </p>
            </div>
            {competition?.prizeImageUrl && (
              <img
                src={competition.prizeImageUrl}
                alt={competition.prizeTitle}
                loading="lazy"
                className="hidden h-28 w-28 shrink-0 rounded-2xl border border-white/15 bg-white object-contain p-2 shadow-2xl md:block"
              />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-300" />
              Server-verified scoring
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} className="text-amber-300" />
              Hard mode earns more
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Gift size={14} className="text-pink-300" />
              No purchase necessary
            </span>
          </div>

          {competition && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs">
              <a
                href={competition.rulesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-black text-violet-200 transition hover:text-white"
              >
                Read official rules <ArrowRight size={13} />
              </a>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                Authorization: {competition.authorizationReference}
              </span>
            </div>
          )}
        </div>

        <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.075] p-5 backdrop-blur-md">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-violet-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">
                  Weekly reset
                </p>
                <p className="mt-1 text-base font-black text-white">
                  Race the clock
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
                <Clock3 size={20} />
              </div>
            </div>

            <div className="my-5 h-px bg-white/10" />

            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-200">
              Ranking closes
            </p>
            <p className="mt-1 text-lg font-black leading-snug text-white">
              {endsAt
                ? endsAt.toLocaleString(undefined, {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })
                : "Every Monday"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Scores reset automatically. Your career stats stay with your
              account.
            </p>
            <Link
              href="/weekly-rules"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-white transition hover:text-violet-200"
            >
              Scoring & eligibility <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

const EMPTY_CLAIM = {
  country: "US" as "US" | "BR",
  fullName: "",
  email: "",
  phone: "",
  postalCode: "",
  addressLine1: "",
  addressNumber: "",
  addressLine2: "",
  neighborhood: "",
  city: "",
  state: "",
};

function PrizeClaimCard({ prize }: { prize: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(EMPTY_CLAIM);
  const claim = trpc.game.claimPrize.useMutation({
    onSuccess: () => utils.game.myPrizeClaim.invalidate(),
  });
  if (prize.claim) {
    return (
      <section
        id="claim-prize"
        className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <div className="flex items-start gap-3">
          <PackageCheck className="mt-0.5 h-6 w-6 text-emerald-600" />
          <div>
            <h2 className="text-lg font-black text-emerald-950">
              Prize claim received
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
              Status: <strong>{prize.claim.status}</strong>
              {prize.claim.trackingCode && (
                <> · Tracking: {prize.claim.trackingCode}</>
              )}
            </p>
          </div>
        </div>
      </section>
    );
  }
  if (!prize.canClaim) return null;
  const isBrazil = form.country === "BR";
  const fields: Array<[keyof typeof EMPTY_CLAIM, string, string]> = [
    ["fullName", "Full legal name", "text"],
    ["email", "Email", "email"],
    ["phone", "Phone (optional)", "tel"],
    ["postalCode", isBrazil ? "CEP" : "ZIP code", "text"],
    ["addressLine1", "Street address", "text"],
    ["addressNumber", "Number", "text"],
    ["addressLine2", isBrazil ? "Complement (optional)" : "Apt / suite (optional)", "text"],
    [
      "neighborhood",
      isBrazil ? "Neighborhood" : "County / district (optional)",
      "text",
    ],
    ["city", "City", "text"],
    ["state", isBrazil ? "State (UF)" : "State", "text"],
  ];
  return (
    <section
      id="claim-prize"
      className="mb-6 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 shadow-lg sm:p-7"
    >
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-7 w-7 text-amber-600" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-700">
            You finished #1
          </p>
          <h2 className="mt-1 text-2xl font-black text-gray-950">
            Claim {prize.competition.prizeTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Shipping data is private, visible only to the fulfillment admin and
            never shown on the leaderboard.
          </p>
        </div>
      </div>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-2"
        onSubmit={event => {
          event.preventDefault();
          claim.mutate({
            ...form,
            phone: form.phone || undefined,
            addressLine2: form.addressLine2 || undefined,
            state: form.state.toUpperCase(),
          });
        }}
      >
        <label className="text-xs font-bold text-gray-700 sm:col-span-2">
          Shipping country
          <select
            value={form.country}
            onChange={event =>
              setForm(value => ({
                ...value,
                country: event.target.value as "US" | "BR",
                postalCode: "",
                neighborhood: "",
                state: "",
              }))
            }
            className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          >
            <option value="US">United States</option>
            <option value="BR">Brazil</option>
          </select>
        </label>
        {fields.map(([key, label, type]) => (
          <label key={key} className="text-xs font-bold text-gray-700">
            {label}
            <input
              type={type}
              required={!label.includes("optional")}
              maxLength={key === "state" ? 2 : undefined}
              value={form[key]}
              onChange={event =>
                setForm(value => ({ ...value, [key]: event.target.value }))
              }
              className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
        ))}
        <div className="sm:col-span-2 mt-2 flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-xl items-start gap-2 text-[11px] leading-5 text-gray-600">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            Used only to deliver this prize. Confirm the address before sending;
            resubmission is blocked for safety. RarityGrid covers prize
            delivery; winners are never charged to claim.
          </p>
          <Button
            type="submit"
            disabled={claim.isPending}
            className="shrink-0 rounded-full bg-violet-600 px-6 font-black text-white"
          >
            {claim.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            Send shipping details
          </Button>
        </div>
        {claim.error && (
          <p className="sm:col-span-2 text-sm font-bold text-red-600">
            {claim.error.message}
          </p>
        )}
      </form>
    </section>
  );
}

export default function GuessGame() {
  usePageMeta(
    "Guess the Pokémon",
    "Guess the hidden Pokémon, earn points and climb the RarityGrid leaderboard."
  );
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<GameDifficulty>("medium");
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQ = trpc.game.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const statsQ = trpc.game.myStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const boardQ = trpc.game.leaderboard.useQuery({ limit: 10 });
  const weeklyQ = trpc.game.weeklyLeaderboard.useQuery({ limit: 10 });
  const claimQ = trpc.game.myPrizeClaim.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const startM = trpc.game.start.useMutation({
    onSuccess: res => {
      setSelectedDifficulty(res.difficulty);
      setShowModal(false);
      setQ("");
      utils.game.current.invalidate();
    },
  });
  const guessM = trpc.game.guess.useMutation({
    onSuccess: res => {
      setQ("");
      utils.game.current.invalidate();
      if (res.status !== "active") {
        setShowModal(true);
        utils.game.myStats.invalidate();
        utils.game.leaderboard.invalidate();
        utils.game.weeklyLeaderboard.invalidate();
        utils.game.myPrizeClaim.invalidate();
      }
    },
  });

  const round = currentQ.data;
  const active = round?.status === "active";
  const lastResult = guessM.data;

  // Suggestions from the existing Pokédex index (fuzzy prefix search)
  const sugQ = trpc.pokemon.list.useQuery(
    { q, page: 1, pageSize: 8 },
    { enabled: q.trim().length >= 2 && !!active }
  );
  const suggestions = (sugQ.data?.items ?? []) as Array<{
    id: number;
    name: string;
    sprite: string;
    types: string[];
  }>;

  useEffect(() => setHighlight(0), [q]);
  useEffect(() => {
    if (round?.difficulty) setSelectedDifficulty(round.difficulty);
  }, [round?.difficulty]);

  const submitGuess = (pokemonId: number) => {
    if (!round || !active || guessM.isPending) return;
    guessM.mutate({ roundId: round.roundId, pokemonId });
  };

  const attemptsRemaining = round?.attemptsRemaining ?? 15;
  const maxAttempts = round?.maxAttempts ?? 15;
  const pct = (attemptsRemaining / maxAttempts) * 100;
  const barColor = pct > 60 ? "#10B981" : pct > 30 ? "#F59E0B" : "#EF4444";
  const pointsPerAttempt =
    round?.pointsPerAttempt ?? lastResult?.pointsPerAttempt ?? 15;
  const potential = attemptsRemaining * pointsPerAttempt;
  const activeMode =
    MODES[round?.difficulty ?? lastResult?.difficulty ?? selectedDifficulty];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f7fc_0%,#ffffff_42%,#f8fafc_100%)] pb-16">
      <div className="container py-6 sm:py-8">
        <section
          className={`relative mb-5 overflow-hidden rounded-[32px] bg-[#0a1022] px-5 text-white shadow-[0_30px_80px_-42px_rgba(49,46,129,.9)] sm:px-8 ${
            isAuthenticated ? "py-6 sm:py-7" : "py-7 sm:py-9"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_15%,rgba(124,58,237,.5),transparent_31%),radial-gradient(circle_at_12%_100%,rgba(14,165,233,.24),transparent_38%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:42px_42px]" />

          <div
            className={`relative grid items-center gap-8 ${
              isAuthenticated
                ? ""
                : "lg:grid-cols-[minmax(0,1fr)_330px]"
            }`}
          >
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-200">
                  <Sparkles size={13} /> RarityGrid Guess Arena
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-slate-300">
                  Free to play
                </span>
              </div>
              <h1
                className={`max-w-3xl font-black leading-[.98] tracking-[-.04em] text-white ${
                  isAuthenticated
                    ? "text-3xl sm:text-4xl"
                    : "text-4xl sm:text-5xl lg:text-6xl"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                Who&apos;s that
                <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                  Pokémon?
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Read the heat, connect each clue and identify the mystery
                Pokémon before your guesses run out. Every win can move you up
                the weekly ranking.
              </p>
              <div
                className={`flex flex-wrap gap-3 text-xs font-black ${
                  isAuthenticated ? "mt-4" : "mt-6"
                }`}
              >
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/[.08] px-3.5 py-2.5 text-white">
                  <Crosshair size={15} className="text-sky-300" /> 3 difficulty
                  modes
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/[.08] px-3.5 py-2.5 text-white">
                  <Trophy size={15} className="text-amber-300" /> Weekly
                  leaderboard
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/[.08] px-3.5 py-2.5 text-white">
                  <ShieldCheck size={15} className="text-emerald-300" /> Fair
                  server scoring
                </span>
              </div>
            </div>

            <div
              className={`relative mx-auto h-[250px] w-full max-w-[310px] ${
                isAuthenticated ? "hidden" : "hidden lg:block"
              }`}
            >
              <div className="absolute inset-x-3 bottom-1 h-12 rounded-full bg-violet-500/30 blur-2xl" />
              <div className="absolute left-1/2 top-1/2 h-56 w-44 -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-[30px] border border-white/10 bg-white/[.07]" />
              <div className="absolute left-1/2 top-1/2 flex h-56 w-44 -translate-x-1/2 -translate-y-1/2 -rotate-3 flex-col items-center justify-center overflow-hidden rounded-[30px] border border-violet-300/25 bg-gradient-to-b from-violet-500/35 to-[#121a34] shadow-2xl backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/[.07]">
                  <div className="absolute inset-2 animate-pulse rounded-full border border-violet-300/25" />
                  <span className="text-6xl font-black text-white/90">?</span>
                </div>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[.24em] text-violet-200">
                  Mystery target
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  Connect the clues
                </p>
              </div>
              <div className="absolute right-0 top-4 rounded-2xl border border-white/10 bg-white/[.09] px-3 py-2 text-xs font-black shadow-xl backdrop-blur">
                <Star size={13} className="mr-1 inline text-amber-300" />
                Up to 270 pts
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <div className="relative mt-7 grid max-w-md grid-cols-2 gap-3 border-t border-white/10 pt-5">
              <div className="rounded-2xl border border-violet-300/15 bg-violet-400/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[.14em] text-violet-200">
                  Round potential
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  {active ? potential : (lastResult?.roundScore ?? 0)}
                  <span className="ml-1 text-xs text-violet-200">pts</span>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[.14em] text-amber-200">
                  Career score
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  {statsQ.data?.totalPoints ?? 0}
                  <span className="ml-1 text-xs text-amber-200">pts</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <WeeklyArenaBanner data={weeklyQ.data} />
        {claimQ.data && <PrizeClaimCard prize={claimQ.data} />}

        {!isAuthenticated ? (
          <div className="mx-auto max-w-xl rounded-[28px] border border-violet-100 bg-white p-8 text-center shadow-[0_24px_65px_-42px_rgba(76,29,149,.65)] sm:p-11">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <Trophy size={27} />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">
              Sign in and enter the arena
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Your wins, streak and weekly score are saved securely to your
              RarityGrid account.
            </p>
            <Link href="/login">
              <Button className="mt-6 rounded-full bg-violet-600 px-7 font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700">
                Sign in to play <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── Game column ── */}
          <div className="min-w-0">
            {!round || round.status !== "active" ? (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 text-center shadow-[0_24px_65px_-48px_rgba(15,23,42,.6)] sm:p-8">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-600">
                  <Sparkles size={24} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">
                  Pick your challenge
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Choose your difficulty
                </h2>
                <p className="mx-auto mb-7 mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  Start with familiar icons or risk fewer guesses for a much
                  bigger weekly score.
                </p>

                <div
                  className="grid sm:grid-cols-3 gap-3 text-left mb-6"
                  role="radiogroup"
                  aria-label="Game difficulty"
                >
                  {(
                    Object.entries(MODES) as Array<
                      [GameDifficulty, typeof MODES.easy]
                    >
                  ).map(([key, mode]) => {
                    const selected = selectedDifficulty === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedDifficulty(key)}
                        className="group relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                        style={{
                          borderColor: selected ? mode.accent : "#e5e7eb",
                          background: selected ? mode.soft : "#fff",
                          boxShadow: selected
                            ? `0 16px 36px ${mode.border}a0`
                            : "none",
                        }}
                      >
                        <div
                          className="absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity group-hover:opacity-100"
                          style={{
                            background: mode.accent,
                            opacity: selected ? 1 : undefined,
                          }}
                        />
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                              background: mode.soft,
                              color: mode.accent,
                            }}
                          >
                            {mode.icon}
                          </span>
                          {selected && (
                            <span
                              className="text-[10px] font-black uppercase tracking-wider"
                              style={{ color: mode.accent }}
                            >
                              Selected
                            </span>
                          )}
                        </div>
                        <div
                          className="font-black text-base"
                          style={{ color: selected ? mode.accent : "#111827" }}
                        >
                          {mode.label}
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                          {mode.subtitle}
                        </div>
                        <p className="text-xs leading-relaxed text-gray-500 min-h-12">
                          {mode.description}
                        </p>
                        <div className="flex justify-between gap-2 border-t mt-3 pt-3 text-[11px] font-bold">
                          <span className="text-gray-500">
                            {mode.attempts} guesses
                          </span>
                          <span style={{ color: mode.accent }}>
                            Up to {mode.maxScore} pts
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={() =>
                    startM.mutate({ difficulty: selectedDifficulty })
                  }
                  disabled={startM.isPending}
                  className="h-12 rounded-full px-8 font-black text-white shadow-lg transition hover:-translate-y-0.5"
                  style={{ background: MODES[selectedDifficulty].accent }}
                >
                  {startM.isPending ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Flame size={16} className="mr-2" />
                  )}{" "}
                  Start {MODES[selectedDifficulty].label}
                </Button>
                {startM.error && (
                  <p className="text-xs text-red-500 font-medium mt-3">
                    {startM.error.message}
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Attempts bar */}
                <div className="relative mb-4 overflow-hidden rounded-[26px] border border-slate-700 bg-[#11182c] p-5 text-white shadow-xl">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{
                          background: `${activeMode.accent}25`,
                          color: activeMode.accent,
                        }}
                      >
                        {activeMode.icon}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.17em] text-slate-400">
                          Active challenge
                        </p>
                        <p className="text-lg font-black text-white">
                          {activeMode.label} mode
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">
                        Guesses left
                      </p>
                      <p className="text-2xl font-black" style={{ color: barColor }}>
                        {attemptsRemaining}
                        <span className="text-sm text-slate-500">
                          {" "}
                          / {maxAttempts}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="relative mt-5">
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg,${barColor},${activeMode.accent})`,
                        }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                      <span>Each guess reveals a stronger clue</span>
                      <span>
                        <strong className="text-white">{pointsPerAttempt} pts</strong>{" "}
                        per remaining guess
                      </span>
                    </div>
                  </div>
                </div>

                {/* Guess input (sticky) */}
                <div className="sticky top-20 z-20 mb-4">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      ref={inputRef}
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlight(h =>
                            Math.min(h + 1, suggestions.length - 1)
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlight(h => Math.max(h - 1, 0));
                        } else if (e.key === "Enter" && suggestions[highlight])
                          submitGuess(suggestions[highlight].id);
                      }}
                      placeholder="Type or search Pokémon name…"
                      disabled={guessM.isPending}
                      className="w-full rounded-2xl border-2 border-violet-200 bg-white py-4 pl-11 pr-12 text-sm font-bold shadow-[0_16px_40px_-28px_rgba(76,29,149,.8)] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                    {guessM.isPending && (
                      <Loader2
                        size={18}
                        className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-violet-500"
                      />
                    )}
                    {q.trim().length >= 2 && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl overflow-hidden z-30">
                        {suggestions.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => submitGuess(p.id)}
                            onMouseEnter={() => setHighlight(i)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === highlight ? "bg-violet-50" : ""}`}
                          >
                            <img
                              src={p.sprite}
                              alt=""
                              className="w-9 h-9 object-contain"
                              loading="lazy"
                            />
                            <span className="font-semibold text-sm">
                              {cap(p.name)}
                            </span>
                            <span className="ml-auto text-[11px] text-gray-400">
                              #{p.id}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {q.trim().length >= 2 &&
                      !sugQ.isFetching &&
                      suggestions.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl px-4 py-3 text-sm text-gray-500 z-30">
                          Pokémon not found, try another.
                        </div>
                      )}
                  </div>
                  {guessM.error && (
                    <p className="text-xs text-red-500 font-medium mt-2 px-4">
                      {guessM.error.message}
                    </p>
                  )}
                </div>

                {/* Feedback stack (newest first, persists) */}
                <div className="space-y-2.5">
                  {(round.guesses ?? []).map((g: any, idx: number) => {
                    const t = TIER[g.tier] ?? TIER.red;
                    return (
                      <div
                        key={`${g.guess.id}-${g.attempt}`}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${idx === 0 ? "animate-fade-in" : ""}`}
                        style={{
                          background: t.bg,
                          borderLeft: `4px solid ${t.bar}`,
                        }}
                      >
                        <span style={{ color: t.bar }}>{t.icon}</span>
                        <img
                          src={g.guess.sprite}
                          alt={g.guess.name}
                          className="w-12 h-12 object-contain"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-bold text-sm"
                              style={{ color: t.text }}
                            >
                              {g.guess.name}
                            </span>
                            <span
                              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white"
                              style={{ background: t.bar }}
                            >
                              {t.label}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: t.text }}
                          >
                            {g.message}
                          </p>
                          <p className="text-xs text-gray-500">{g.detail}</p>
                          {g.comparisons && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <HintChip
                                ok={g.comparisons.family}
                                label="Evolution line"
                              />
                              <HintChip
                                ok={!!g.comparisons.sharedType}
                                label={
                                  g.comparisons.sharedType
                                    ? `${cap(g.comparisons.sharedType)} energy`
                                    : `${(g.guess.types ?? []).map(cap).join("/") || "?"} energy`
                                }
                              />
                              <HintChip
                                ok={g.comparisons.generation}
                                label={`Gen ${g.guess.generation}`}
                              />
                              <HintChip
                                ok={g.comparisons.region}
                                label={g.guess.region}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium shrink-0">
                          Attempt {g.attempt} / {maxAttempts}
                        </span>
                      </div>
                    );
                  })}
                  {(round.guesses ?? []).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Crosshair size={19} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-500">
                        Make your first guess
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Heat and comparison clues will stack here.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar: stats + leaderboard ── */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-3 flex items-center gap-2">
                <Medal size={16} className="text-violet-500" /> Your Stats
              </h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-violet-600">
                    {statsQ.data?.totalPoints ?? 0}
                  </div>
                  <div className="text-[11px] text-gray-500 font-semibold">
                    Total Points
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-emerald-600">
                    {statsQ.data?.wins ?? 0}
                  </div>
                  <div className="text-[11px] text-gray-500 font-semibold">
                    Wins
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-amber-500">
                    {statsQ.data?.streak ?? 0}
                  </div>
                  <div className="text-[11px] text-gray-500 font-semibold">
                    Win Streak
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-lg font-black text-gray-700">
                    {statsQ.data?.bestAttempts ?? "—"}
                  </div>
                  <div className="text-[11px] text-gray-500 font-semibold">
                    Best (attempts)
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[26px] border border-violet-200 bg-gradient-to-b from-[#17122f] to-[#0e1529] p-5 text-white shadow-[0_24px_55px_-34px_rgba(76,29,149,.9)]">
              <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" />
              <div className="relative mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">
                    Live standings
                  </p>
                  <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-white">
                    <Trophy size={18} className="text-amber-300" /> This Week
                  </h3>
                </div>
                {weeklyQ.data?.myRank && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white">
                    You: #{weeklyQ.data.myRank.position}
                  </span>
                )}
              </div>
              {(weeklyQ.data?.rows ?? []).length === 0 && (
                <div className="relative rounded-2xl border border-white/10 bg-white/[.06] p-5 text-center">
                  <Crown className="mx-auto h-7 w-7 text-amber-300" />
                  <p className="mt-2 text-sm font-black text-white">
                    The top spot is open
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Win a round and become the first trainer on the board.
                  </p>
                </div>
              )}
              <div className="relative space-y-2">
                {(weeklyQ.data?.rows ?? []).map((row: any, i: number) => (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                      row.name === user?.name
                        ? "border-violet-300/35 bg-violet-400/15"
                        : "border-white/[.07] bg-white/[.055]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                        i === 0
                          ? "bg-amber-300 text-amber-950"
                          : i === 1
                            ? "bg-slate-300 text-slate-800"
                            : i === 2
                              ? "bg-orange-300 text-orange-950"
                              : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {row.avatarUrl ? (
                      <img
                        src={row.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-300/15 text-[11px] font-black text-violet-200">
                        {(row.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 truncate text-sm font-bold text-white">
                      {row.name ?? row.username ?? "Trainer"}
                    </span>
                    <span className="text-sm font-black text-violet-200">
                      {row.points} <small className="text-[9px] text-slate-500">PTS</small>
                    </span>
                  </div>
                ))}
              </div>
              <p className="relative mt-4 border-t border-white/10 pt-4 text-[11px] leading-5 text-slate-400">
                Only the first {weeklyQ.data?.dailyLimit ?? 10} wins each day
                score. Ties favor more Hard wins, then the earliest final score.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-gray-500">
                <Medal size={16} className="text-violet-500" /> Career leaders
              </h3>
              <div className="space-y-1.5">
                {(boardQ.data ?? []).slice(0, 5).map((row: any, i: number) => (
                  <div
                    key={row.userId}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-5 font-black text-gray-300">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {row.name ?? row.username ?? "Trainer"}
                    </span>
                    <span className="font-black text-violet-600">
                      {row.totalPoints}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 rounded-[24px] border border-slate-200 bg-white p-5 text-xs text-gray-500">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">
                How warmth works
              </h3>
              <p>
                <span className="font-bold" style={{ color: "#10B981" }}>
                  ● Green
                </span>{" "}
                — same evolutionary line (hottest hint)
              </p>
              <p>
                <span className="font-bold" style={{ color: "#F59E0B" }}>
                  ● Yellow
                </span>{" "}
                — same energy type or generation
              </p>
              <p>
                <span className="font-bold" style={{ color: "#3B82F6" }}>
                  ● Blue
                </span>{" "}
                — close, neighboring generation
              </p>
              <p>
                <span className="font-bold" style={{ color: "#EF4444" }}>
                  ● Red
                </span>{" "}
                — completely different
              </p>
              <div className="border-t mt-3 pt-3 space-y-1">
                <p>
                  <strong className="text-emerald-600">Easy:</strong> up to 120
                  pts · famous Pokémon
                </p>
                <p>
                  <strong className="text-violet-600">Medium:</strong> up to 180
                  pts · broad selection
                </p>
                <p>
                  <strong className="text-rose-600">Hard:</strong> up to 270 pts
                  · full National Dex
                </p>
              </div>
              <p className="pt-1">
                Every wrong guess lowers the available score. Points accumulate
                on the leaderboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Game-over modal */}
      {showModal && lastResult?.reveal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-8 text-center relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="absolute inset-x-0 top-0 h-24 opacity-20"
              style={{
                background:
                  lastResult.status === "won"
                    ? "linear-gradient(135deg,#10B981,#7C3AED)"
                    : "linear-gradient(135deg,#EF4444,#7C3AED)",
              }}
            />
            <div
              className={`relative ${lastResult.status === "won" ? "animate-bounce" : ""}`}
            >
              <img
                src={lastResult.reveal.sprite}
                alt={lastResult.reveal.name}
                className="w-40 h-40 object-contain mx-auto drop-shadow-xl"
              />
            </div>
            <h2
              className="text-2xl font-black mt-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {lastResult.status === "won" ? "You got it!" : "Out of attempts!"}
            </h2>
            <p className="text-gray-500 text-sm mb-1">
              The Pokémon was{" "}
              <span className="font-bold text-gray-800">
                {lastResult.reveal.name}
              </span>
            </p>
            <p className="text-xs text-gray-400 mb-4">
              {lastResult.reveal.types.map(cap).join(" / ")} · Gen{" "}
              {lastResult.reveal.generation} · {lastResult.reveal.region}
            </p>
            <div className="flex justify-center gap-3 mb-6">
              <div className="rounded-xl bg-gray-50 px-4 py-2">
                <div className="text-lg font-black">
                  {lastResult.maxAttempts - (lastResult.attemptsRemaining ?? 0)}{" "}
                  / {lastResult.maxAttempts}
                </div>
                <div className="text-[11px] text-gray-500 font-semibold">
                  Attempts used
                </div>
              </div>
              <div className="rounded-xl bg-violet-50 px-4 py-2">
                <div className="text-lg font-black text-violet-600">
                  +{lastResult.roundScore}
                </div>
                <div className="text-[11px] text-gray-500 font-semibold">
                  Points earned
                </div>
              </div>
            </div>
            {lastResult.status === "won" && lastResult.weeklyResult && (
              <div
                className={`mb-5 rounded-xl border px-3 py-2 text-xs font-bold ${
                  lastResult.weeklyResult.awarded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {lastResult.weeklyResult.awarded
                  ? `+${"points" in lastResult.weeklyResult ? lastResult.weeklyResult.points : 0} points added to this week's ranking.`
                  : `Daily ranking limit reached. Your career stats still count.`}
              </div>
            )}
            <p
              className="text-[11px] font-black uppercase tracking-wider mb-5"
              style={{ color: MODES[lastResult.difficulty].accent }}
            >
              {lastResult.difficultyLabel} mode · max {lastResult.maxScore}{" "}
              points
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() =>
                  startM.mutate({ difficulty: lastResult.difficulty })
                }
                disabled={startM.isPending}
                className="rounded-full font-bold text-white px-5"
                style={{ background: MODES[lastResult.difficulty].accent }}
              >
                <RotateCcw size={15} className="mr-2" /> Play Again
              </Button>
              <Link href="/marketplace">
                <Button
                  variant="outline"
                  className="rounded-full font-bold px-5"
                >
                  Back to Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
