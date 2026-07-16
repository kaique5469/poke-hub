import { Link } from "wouter";
import {
  ArrowRight,
  BookMarked,
  MessageSquareOff,
  ShieldCheck,
  Store,
  Swords,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";

const destinations = [
  {
    title: "Marketplace",
    description: "Browse verified products and real seller listings.",
    href: "/shop",
    icon: Store,
  },
  {
    title: "Decks",
    description: "Build and publish a competitive Pokémon TCG deck.",
    href: "/decks",
    icon: Swords,
  },
  {
    title: "Tournaments",
    description: "Open tournament references and competitive resources.",
    href: "/tournaments",
    icon: Trophy,
  },
  {
    title: "Binder",
    description: "Keep your personal collection organized in one place.",
    href: "/binder",
    icon: BookMarked,
  },
];

export default function Community() {
  usePageMeta(
    "Community",
    "TCG Arena community tools for Pokémon TCG collectors, players and sellers."
  );
  const { isAuthenticated } = useAuth();

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="overflow-hidden bg-[#0b1020] text-white">
        <div className="container grid gap-10 py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              Community, built on real activity
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              A collector network without fake posts or fake engagement.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Public posting is being opened gradually with moderation, verified
              profiles and reporting. Until then, every visible count and
              listing on TCG Arena comes from an actual account or data source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white"
                >
                  Open my dashboard
                </Link>
              ) : (
                <a
                  href={getLoginUrl()}
                  className="rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white"
                >
                  Create a collector account
                </a>
              )}
              <Link
                href="/bazaar"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                Open Bazaar
              </Link>
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl">
            <MessageSquareOff className="h-10 w-10 text-violet-300" />
            <h2 className="mt-5 text-2xl font-black">
              Public feed is not live yet
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              We removed demonstration profiles, likes and comments. The feed
              will return only when posting, moderation, persistence and abuse
              controls are fully connected.
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-xs leading-5 text-emerald-100">
                No sample users are presented as real collectors.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {destinations.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"
            >
              <Icon className="h-6 w-6 text-violet-600" />
              <h2 className="mt-4 font-black text-gray-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-black text-violet-700">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
