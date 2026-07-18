import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Gamepad2,
  LineChart,
  ShieldCheck,
  Store,
  Trophy,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Community() {
  usePageMeta(
    "Community Pulse",
    "Real Pokémon TCG market activity, public decks and collector game rankings on RarityGrid."
  );
  const { isAuthenticated } = useAuth();
  const market = trpc.market.overview.useQuery({ period: 7 });
  const decks = trpc.decks.publicDecks.useQuery();
  const leaderboard = trpc.game.leaderboard.useQuery({ limit: 5 });
  const summary = market.data?.summary;

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="bg-[#0b1020] text-white">
        <div className="container grid gap-10 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">
              Community Pulse
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              Real collectors. Real activity. No manufactured engagement.
            </h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              Follow verified market observations, discover decks shared by
              members and compete on the live Guess the Pokémon leaderboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={isAuthenticated ? "/dashboard" : getLoginUrl()}
                className="rounded-full bg-violet-600 px-5 py-3 text-sm font-black"
              >
                {isAuthenticated
                  ? "Open my dashboard"
                  : "Become a founding member"}
              </a>
              <Link
                href="/market"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black"
              >
                Open Market Pulse
              </Link>
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-7">
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-wider">
                Source policy
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black">
              The numbers below come from the platform.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Search and view activity is recorded with rate limits. Sales count
              only paid marketplace orders. Empty communities remain honestly
              empty.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <DarkStat label="Tracked" value={summary?.trackedCards ?? 0} />
              <DarkStat label="Views 24h" value={summary?.views24h ?? 0} />
              <DarkStat label="Sales 30d" value={summary?.sales30d ?? 0} />
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 py-12 lg:grid-cols-3">
        <Panel
          icon={LineChart}
          title="Cards collectors are watching"
          href="/market"
        >
          {(market.data?.mostWatched ?? []).slice(0, 5).map(card => (
            <Link
              key={card.cardId}
              href={`/cards/${card.cardId}`}
              className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
            >
              <div className="h-12 w-9 rounded bg-gray-100">
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{card.cardName}</p>
                <p className="text-xs text-gray-500">
                  {card.watchers} watch{card.watchers === 1 ? "" : "es"}
                </p>
              </div>
              <span className="text-sm font-black">
                {card.currentPrice == null
                  ? "—"
                  : `$${card.currentPrice.toFixed(2)}`}
              </span>
            </Link>
          ))}
          {!market.isLoading && !market.data?.mostWatched.length && (
            <Empty text="No watchlist activity yet. Watch a card to become the first signal." />
          )}
        </Panel>
        <Panel icon={BookOpen} title="Latest public decks" href="/decks">
          {(decks.data ?? []).slice(0, 5).map(deck => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="block border-b border-gray-100 py-3 last:border-0"
            >
              <p className="text-sm font-black">{deck.name}</p>
              <p className="mt-1 text-xs capitalize text-gray-500">
                {deck.format} · {deck.cardCount} cards
              </p>
            </Link>
          ))}
          {!decks.isLoading && !decks.data?.length && (
            <Empty text="No public deck yet. Publish the first community deck." />
          )}
        </Panel>
        <Panel icon={Trophy} title="Game leaderboard" href="/guess">
          {(leaderboard.data ?? []).map((player, index) => (
            <div
              key={player.userId}
              className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">
                  {player.name ?? player.username ?? "Collector"}
                </p>
                <p className="text-xs text-gray-500">
                  {player.wins} wins · {player.streak} streak
                </p>
              </div>
              <span className="font-black">{player.totalPoints}</span>
            </div>
          ))}
          {!leaderboard.isLoading && !leaderboard.data?.length && (
            <Empty text="The leaderboard is open. Play to claim first place." />
          )}
        </Panel>
      </section>

      <section className="container pb-14">
        <div className="grid gap-4 md:grid-cols-3">
          <Action
            icon={Store}
            title="Build a trusted store"
            text="Seller terms, Stripe payouts, tracked fulfillment and buyer protection."
            href="/open-store"
          />
          <Action
            icon={Gamepad2}
            title="Compete every day"
            text="Easy, Medium and Hard modes reward different levels of knowledge."
            href="/guess"
          />
          <Action
            icon={BookOpen}
            title="Share useful decks"
            text="Public decklists create discoverable, lasting community content."
            href="/decks"
          />
        </div>
      </section>
    </main>
  );
}

function DarkStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-2xl font-black">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}
function Panel({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: typeof Trophy;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-violet-600" />
          <h2 className="font-black">{title}</h2>
        </div>
        <Link href={href} className="text-violet-600">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-sm leading-6 text-gray-500">{text}</p>
  );
}
function Action({
  icon: Icon,
  title,
  text,
  href,
}: {
  icon: typeof Store;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"
    >
      <Icon className="h-6 w-6 text-violet-600" />
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{text}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-violet-700">
        Get started <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
