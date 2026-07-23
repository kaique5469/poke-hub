import { Link, useLocation } from "wouter";
import { Mail, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePageMeta } from "@/hooks/usePageMeta";

const updated = "20 de julho de 2026";

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
    "Dados de pagamento, CPF e conta bancária são tratados pelo Stripe. O RarityGrid não armazena número completo do cartão nem CPF do vendedor.",
  ],
  [
    "Third-party services",
    "Card and market data may come from Scrydex, Pokémon TCG API and linked retailers. Advertising may be provided by Google AdSense. These providers process information under their own privacy terms.",
  ],
  [
    "Advertising, cookies and device data",
    "RarityGrid uses Google AdSense to fund public content. Google and its advertising partners may use cookies, local storage, device identifiers, IP address, page activity and ad interactions to select, deliver, measure and protect advertising.",
  ],
  [
    "Consent and privacy controls",
    "Where required, visitors receive consent or opt-out controls before personalized advertising is used. Choices can be revisited through the privacy message, and Google advertising preferences can be managed through Google My Ad Center.",
  ],
  [
    "Your choices",
    "You may request correction or deletion of your account information by contacting support.",
  ],
  [
    "Weekly prize fulfillment",
    "Shipping details are requested only from a confirmed weekly winner, restricted to authorized fulfillment administrators, and used to deliver the prize. They are not displayed on rankings or public profiles.",
  ],
];

const termsSections = [
  [
    "Marketplace role",
    "O RarityGrid conecta compradores e vendedores independentes no Brasil. O vendedor responde pela autenticidade, descrição, condição, envio e obrigações fiscais aplicáveis. A plataforma mantém os deveres previstos na legislação brasileira de consumo.",
  ],
  [
    "Pricing data",
    "Displayed prices are market references, not guaranteed sale prices or financial advice. Source availability and update times vary.",
  ],
  [
    "Orders and disputes",
    "Pagamentos por cartão e Pix são processados pelo Stripe em reais. Compradores e vendedores devem fornecer informações verdadeiras e provas em cancelamentos, reclamações de entrega ou disputas.",
  ],
  [
    "Inventory reservations and shipping",
    "O checkout reserva o estoque por 30 minutos. Se o pagamento não for confirmado, a reserva expira. O preço do anúncio inclui frete rastreado para o Brasil e o vendedor deve enviar ao endereço coletado no checkout.",
  ],
  [
    "Fees, refunds and payouts",
    "O RarityGrid desconta 5% de pedidos concluídos. Reembolsos elegíveis retornam ao meio de pagamento original. Os recebimentos do vendedor seguem a confirmação do envio e a janela de proteção aplicável.",
  ],
  [
    "Prohibited activity",
    "Counterfeit goods, manipulated demand, fraudulent payments, harassment, automated abuse and misleading listings are prohibited.",
  ],
  [
    "Weekly Arena",
    "The skill leaderboard resets weekly. Only a limited number of daily wins score to reduce automated abuse. A physical prize exists only when an authorized competition, public official rules, eligibility and authorization reference are displayed on the game page. No purchase is necessary.",
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
