import { Link, useLocation } from "wouter";
import { Mail, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";

const updated = "July 18, 2026";

const privacySections = [
  [
    "Information we collect",
    "Account details, listings, orders, collection data and technical logs needed to operate and secure the service.",
  ],
  [
    "How information is used",
    "To provide marketplace features, protect transactions, prevent abuse, improve reliability and respond to support requests.",
  ],
  [
    "Payments",
    "Payment details are handled by Stripe. RarityGrid does not store full card numbers.",
  ],
  [
    "Third-party services",
    "Card and market data may come from Scrydex, Pokémon TCG API and linked retailers. Their own privacy terms apply when you leave RarityGrid.",
  ],
  [
    "Your choices",
    "You may request correction or deletion of your account information by contacting support.",
  ],
];

const termsSections = [
  [
    "Marketplace role",
    "RarityGrid provides tools that connect independent buyers and sellers. Sellers are responsible for accurate descriptions, authenticity, condition, fulfillment and applicable taxes.",
  ],
  [
    "Pricing data",
    "Displayed prices are market references, not guaranteed sale prices or financial advice. Source availability and update times vary.",
  ],
  [
    "Orders and disputes",
    "Card payments are processed by Stripe and the seller share is held while an order is fulfilled. Buyers and sellers must provide truthful information and supporting evidence during a cancellation, delivery claim or dispute.",
  ],
  [
    "Inventory reservations and shipping",
    "Checkout reserves inventory for 30 minutes. If payment is not completed, the reservation expires and inventory returns to sale. Marketplace listing prices include tracked shipping within the United States; sellers must ship to the address collected at secure checkout.",
  ],
  [
    "Fees, refunds and payouts",
    "RarityGrid deducts a 5% marketplace fee from completed orders. Eligible refunds return the affected order amount to the original payment method. Seller payouts are released after confirmed fulfillment or the applicable protection window.",
  ],
  [
    "Prohibited activity",
    "Counterfeit goods, manipulated demand, fraudulent payments, harassment, automated abuse and misleading listings are prohibited.",
  ],
  [
    "Third-party purchases",
    "Retailer links open external websites. Inventory, checkout, returns and warranties are controlled by that retailer.",
  ],
  [
    "Pokémon trademarks",
    "Pokémon and related names belong to Nintendo, Creatures Inc. and GAME FREAK. RarityGrid is not endorsed by The Pokémon Company.",
  ],
];

export default function Legal() {
  const [location] = useLocation();
  const info = trpc.site.info.useQuery();
  const isPrivacy = location === "/privacy";
  const isTerms = location === "/terms";
  const title = isPrivacy
    ? "Privacy Policy"
    : isTerms
      ? "Terms of Use"
      : "Contact";
  usePageMeta(title, `${title} for RarityGrid.`);

  if (!isPrivacy && !isTerms) {
    return (
      <main className="min-h-[70vh] bg-[#f6f7fb]">
        <div className="container max-w-3xl py-16">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
            Support
          </p>
          <h1 className="mt-3 text-4xl font-black text-gray-950">
            Contact RarityGrid
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600">
            For account access, seller onboarding, order disputes or data
            corrections, contact the marketplace team and include the relevant
            username or order ID.
          </p>
          <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
            <Mail className="h-7 w-7 text-violet-600" />
            <h2 className="mt-4 text-xl font-black text-gray-950">
              Email support
            </h2>
            {info.data?.contactEmail ? (
              <a
                href={`mailto:${info.data.contactEmail}?subject=RarityGrid%20Support`}
                className="mt-3 inline-flex rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white"
              >
                {info.data.contactEmail}
              </a>
            ) : (
              <p className="mt-3 text-sm text-amber-700">
                The public support inbox is being configured.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const sections = isPrivacy ? privacySections : termsSections;
  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="container max-w-4xl py-16">
        <div className="flex items-center gap-3 text-violet-700">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-xs font-black uppercase tracking-[0.18em]">
            Trust & safety
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-black text-gray-950">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {updated}</p>
        <div className="mt-10 space-y-4">
          {sections.map(([heading, body]) => (
            <section
              key={heading}
              className="rounded-2xl border border-gray-200 bg-white p-6"
            >
              <h2 className="text-lg font-black text-gray-950">{heading}</h2>
              <p className="mt-2 text-sm leading-7 text-gray-600">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-gray-600">
          Questions?{" "}
          <Link href="/contact" className="font-black text-violet-700">
            Contact support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
