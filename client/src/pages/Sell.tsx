/**
 * Sell on RarityGrid — seller landing page.
 * Patterned after TCGplayer / Cardmarket seller pages: value prop, how it
 * works, transparent fees, payments, trust & safety, FAQ, single strong CTA.
 */
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CreditCard,
  Landmark,
  LockKeyhole,
  Package,
  Percent,
  ShieldCheck,
  Star,
  Store,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const VIOLET = "#7C3AED";
const GOLD = "#F5B301";
const INK = "#0B1220";

function SectionTitle({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      <div
        className="text-xs font-black uppercase tracking-[0.2em] mb-2"
        style={{ color: VIOLET }}
      >
        {kicker}
      </div>
      <h2
        className="text-2xl md:text-3xl font-black"
        style={{ fontFamily: "var(--font-display)", color: INK }}
      >
        {title}
      </h2>
      {sub && <p className="text-gray-500 mt-2 text-sm md:text-base">{sub}</p>}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-violet-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-sm" style={{ color: INK }}>
          {q}
        </span>
        <span className="text-violet-600 font-black">{open ? "−" : "+"}</span>
      </div>
      {open && (
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{a}</p>
      )}
    </button>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${VIOLET}15`, color: VIOLET }}
      >
        {icon}
      </div>
      <h3 className="font-black mb-1" style={{ color: INK }}>
        {title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Sell() {
  const { isAuthenticated } = useAuth();
  const myStore = trpc.store.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const ctaHref = !isAuthenticated
    ? getLoginUrl()
    : myStore.data
      ? "/dashboard"
      : "/open-store";
  const ctaLabel = !isAuthenticated
    ? "Sign in to start selling"
    : myStore.data
      ? "Manage your seller account"
      : "Open your store — it's free";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${INK} 0%, #1e1b4b 55%, #4c1d95 100%)`,
        }}
      >
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25"
          style={{ background: VIOLET }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-20"
          style={{ background: GOLD }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-widest rounded-full px-4 py-1.5 mb-6">
            <Store size={14} /> Sell on RarityGrid
          </div>
          <h1
            className="text-3xl md:text-5xl font-black text-white leading-tight max-w-3xl mx-auto"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Turn your collection into a professional store
          </h1>
          <p className="text-white/70 mt-4 max-w-xl mx-auto text-sm md:text-base">
            Reach Pokémon TCG collectors with secure card payments, buyer
            protection and transparent fees — no monthly costs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={ctaHref}
              className="inline-flex items-center gap-2 font-black rounded-full px-8 py-3.5 text-sm uppercase tracking-wide shadow-xl hover:scale-105 transition-transform"
              style={{ background: GOLD, color: INK }}
            >
              {ctaLabel} <ArrowRight size={16} />
            </a>
            <Link
              href="/sell-card"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white font-bold text-sm px-6 py-3.5"
            >
              <Tag size={15} /> Just list a single card
            </Link>
          </div>
          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/60 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole size={14} /> Payments processed by Stripe
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} /> Buyer & seller protection
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Percent size={14} /> No listing fees
            </span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle kicker="How it works" title="Selling in 3 simple steps" />
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              n: "1",
              icon: <Store size={20} />,
              title: "Open your store",
              desc: "Pick a name, accept the seller terms, connect secure card payouts and set your shipping and return policies.",
            },
            {
              n: "2",
              icon: <Tag size={20} />,
              title: "List your cards",
              desc: "Search our full card database, set condition, language and price. Listings appear instantly on card pages and in the shop.",
            },
            {
              n: "3",
              icon: <Package size={20} />,
              title: "Sell & ship",
              desc: "Get notified on every sale. Buyer pays securely on the platform, you ship, everyone builds reputation with reviews.",
            },
          ].map(s => (
            <div
              key={s.n}
              className="relative bg-white border border-gray-200 rounded-2xl p-6 pt-8"
            >
              <div
                className="absolute -top-4 left-6 w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm"
                style={{ background: VIOLET }}
              >
                {s.n}
              </div>
              <div
                className="flex items-center gap-2 font-black mb-2"
                style={{ color: INK }}
              >
                {s.icon} {s.title}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fees ── */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle
            kicker="Pricing"
            title="Transparent fees, no surprises"
            sub="You only pay when you sell. No subscription, no listing fees, no hidden costs."
          />
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                big: "R$ 0",
                label: "To open a store",
                desc: "Free forever. No monthly subscription.",
              },
              {
                big: "0%",
                label: "Listing fee",
                desc: "List as many cards and products as you want.",
              },
              {
                big: "5%",
                label: "Per completed sale",
                desc: "Deducted only when a card-payment sale is completed. Covers payment processing and buyer protection.",
              },
            ].map(f => (
              <div
                key={f.label}
                className="text-center bg-gray-50 border border-gray-200 rounded-2xl p-8"
              >
                <div
                  className="text-4xl font-black mb-1"
                  style={{ color: VIOLET, fontFamily: "var(--font-display)" }}
                >
                  {f.big}
                </div>
                <div
                  className="font-black text-sm uppercase tracking-wide mb-2"
                  style={{ color: INK }}
                >
                  {f.label}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payments ── */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <SectionTitle
          kicker="Payments"
          title="Protected payments, clear payouts"
          sub="Stripe confirms every card payment; RarityGrid holds the seller share until fulfillment is complete."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Feature
            icon={<CreditCard size={20} />}
            title="Card (on-platform)"
            desc="Buyers pay by credit or debit card via Stripe's secure checkout. Funds are confirmed automatically and the order is protected."
          />
          <Feature
            icon={<Landmark size={20} />}
            title="Verified payouts"
            desc="Connect and verify your Stripe account before inventory can go live. Your 95% seller share is released after fulfillment."
          />
          <Feature
            icon={<Wallet size={20} />}
            title="Escrow protection"
            desc="Funds remain held while you ship and are released after the buyer confirms receipt or the protection window ends."
          />
          <Feature
            icon={<Banknote size={20} />}
            title="Auditable settlement"
            desc="Every payment, refund and seller transfer is tied to an order and protected against duplicate processing."
          />
        </div>
      </section>

      {/* ── Trust & safety ── */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle
            kicker="Trust & Safety"
            title="Built for safe trading"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature
              icon={<LockKeyhole size={20} />}
              title="Secure checkout"
              desc="Card payments run on Stripe with PCI-DSS compliance. RarityGrid never stores card numbers."
            />
            <Feature
              icon={<ShieldCheck size={20} />}
              title="Buyer protection"
              desc="On-platform card payments are covered: item not received or not as described? The order can be disputed."
            />
            <Feature
              icon={<BadgeCheck size={20} />}
              title="Verified sellers"
              desc="Stores earn the verified badge after consistent sales and positive reviews — buyers see it everywhere."
            />
            <Feature
              icon={<Star size={20} />}
              title="Public reputation"
              desc="Every completed order can be reviewed. Ratings and sale counts are shown on your store and listings."
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <SectionTitle kicker="FAQ" title="Common questions" />
        <div className="space-y-3">
          <Faq
            q="How much does it cost to sell?"
            a="Abrir a loja e anunciar é grátis. A taxa de 5% incide sobre pedidos concluídos e financia checkout e proteção ao comprador. O frete rastreado no Brasil deve estar incluído no preço."
          />
          <Faq
            q="When do I get paid?"
            a="Connect and verify Stripe from your dashboard. After a buyer pays, your 95% seller share is held during fulfillment and released when receipt is confirmed or the protection window ends. Stripe then sends it to your bank according to your payout schedule."
          />
          <Faq
            q="What do I need to open a store?"
            a="A RarityGrid account, a store name, accepted seller terms and a verified Stripe payout account. Clear shipping and return policies are required for buyer trust."
          />
          <Faq
            q="How is the card condition handled?"
            a="Every listing declares a condition from Mint to Damaged using the industry-standard scale. Misgraded cards can be disputed by the buyer, so grade conservatively."
          />
          <Faq
            q="Can I sell sealed products too?"
            a="Yes — booster boxes, ETBs and other sealed products can be listed from the Shop section alongside single cards."
          />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div
          className="rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(120deg, ${VIOLET} 0%, #a21caf 60%, #FF2E9A 100%)`,
          }}
        >
          <Truck
            size={140}
            className="absolute -right-6 -bottom-8 text-white/10 rotate-6"
          />
          <h2
            className="text-2xl md:text-4xl font-black text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready to open your store?
          </h2>
          <p className="text-white/80 mt-2 text-sm md:text-base">
            Join RarityGrid sellers today. Free to start, 5 minutes to set up.
          </p>
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 mt-6 font-black rounded-full px-8 py-3.5 text-sm uppercase tracking-wide bg-white hover:scale-105 transition-transform"
            style={{ color: VIOLET }}
          >
            {ctaLabel} <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
