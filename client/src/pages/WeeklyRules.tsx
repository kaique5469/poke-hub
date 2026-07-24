import { Link } from "wouter";
import { ShieldCheck, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function WeeklyRules() {
  usePageMeta(
    "Weekly Arena Rules & Active Prize",
    "Rules, scoring, eligibility and authorization for the active RarityGrid Weekly Arena."
  );
  const weekly = trpc.game.weeklyLeaderboard.useQuery({ limit: 3 });
  const competition = weekly.data?.competition;
  const eligibleTerritory =
    competition?.eligibleCountry === "US"
      ? "United States"
      : competition?.eligibleCountry === "BR"
        ? "Brazil"
        : "United States and Brazil";
  return (
    <main className="min-h-screen bg-[#f6f7fb] py-14">
      <div className="container max-w-4xl">
        <div className="rounded-3xl bg-[#0b1020] p-7 text-white shadow-xl sm:p-10">
          <Trophy className="h-9 w-9 text-amber-300" />
          <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-violet-300">
            RarityGrid Weekly Arena
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">
            Weekly Arena rules
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            This page summarizes the ranking and displays the current authorized
            prize round. The complete published rules for an active promotion
            always control.
          </p>
        </div>

        {!competition ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <h2 className="text-xl font-black text-amber-950">
              No physical-prize competition is active
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Players may use the Weekly Arena in practice mode. No physical
              prize is promised for this period.
            </p>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-gray-950">
              {competition.prizeTitle}
            </h2>
            {competition.prizeDescription && (
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {competition.prizeDescription}
              </p>
            )}
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <Rule label="Eligible territory" value={eligibleTerritory} />
              <Rule
                label="Authorization reference"
                value={competition.authorizationReference}
              />
              <Rule
                label="Start"
                value={new Date(competition.startsAt).toLocaleString()}
              />
              <Rule
                label="End"
                value={new Date(competition.endsAt).toLocaleString()}
              />
            </dl>
            <a
              href={competition.rulesUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white"
            >
              Read the complete official rules
            </a>
          </section>
        )}

        <div className="mt-8 space-y-4">
          {[
            [
              "Entry and eligibility",
              "Participation is free and requires a valid RarityGrid account. No purchase is necessary. Physical-prize eligibility is limited to residents of the United States or Brazil who satisfy every requirement in the active official rules, including any age or state restrictions.",
            ],
            [
              "Scoring",
              `Game answers and points are validated by the server. Only the first ${weekly.data?.dailyLimit ?? 10} wins per player each São Paulo calendar day score in the weekly ranking; additional play still counts toward career statistics.`,
            ],
            [
              "Winner and tie-break",
              "The eligible player in first place when the period closes wins. Ties are resolved by more Hard-mode wins and then by the earliest time the final score was reached.",
            ],
            [
              "Fair play",
              "Bots, multiple-account manipulation, automation, exploiting defects or other fraudulent behavior may cause disqualification after an auditable review.",
            ],
            [
              "Claim and delivery",
              "The winner is notified by email and in the account. The prize must be claimed within 7 days through the private form. RarityGrid covers prize delivery; a winner is never charged to claim. Shipping details are used only for fulfillment and are never public.",
            ],
          ].map(([title, body]) => (
            <section key={title} className="rounded-2xl border bg-white p-6">
              <h2 className="font-black text-gray-950">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-gray-600">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-gray-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Pokémon names and products belong to their respective owners.
          RarityGrid is not endorsed by The Pokémon Company.
        </p>
        <Link
          href="/game"
          className="mt-6 inline-flex rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white"
        >
          Return to Weekly Arena
        </Link>
      </div>
    </main>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-gray-800">{value}</dd>
    </div>
  );
}
