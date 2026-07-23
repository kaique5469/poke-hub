/**
 * Open Store wizard — 3 steps: identity → payments & shipping → review.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { MARKETPLACE_TERMS_VERSION } from "@shared/marketplace";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

const VIOLET = "#7C3AED";
const INK = "#0B1220";

const PAYMENT_OPTIONS = [
  {
    value: "card",
    label: "Cartão e Pix (na plataforma)",
    icon: <CreditCard size={18} />,
    desc: "Checkout seguro Stripe em reais. Seus dados de CPF e conta bancária são informados diretamente ao Stripe.",
    recommended: true,
  },
  {
    value: "pix",
    label: "Pix",
    icon: <CreditCard size={18} />,
    desc: "Confirmação pelo Stripe. O pedido só é liberado para envio depois que o pagamento for confirmado.",
    recommended: true,
  },
] as const;

type PayMethod = (typeof PAYMENT_OPTIONS)[number]["value"];

const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const STEPS = [
  { n: 1, label: "Identidade" },
  { n: 2, label: "Pagamento e envio" },
  { n: 3, label: "Revisão" },
] as const;

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white";
const labelCls =
  "block text-xs font-black uppercase tracking-wide text-gray-600 mb-1.5";

export default function OpenStore() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const myStore = trpc.store.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — identity
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Step 2 — payments & shipping
  const payments: PayMethod[] = ["card", "pix"];
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [handlingDays, setHandlingDays] = useState(2);
  const [shippingPolicy, setShippingPolicy] = useState(
    "O frete rastreado para todo o Brasil está incluído no preço do anúncio. As cartas são enviadas com sleeve, proteção rígida e embalagem segura."
  );
  const [returnPolicy, setReturnPolicy] = useState(
    "O comprador pode exercer o direito de arrependimento nos prazos legais. Produto diferente do anúncio ou danificado será tratado pela proteção ao comprador."
  );

  // Step 3 — terms
  const [agreed, setAgreed] = useState(false);

  const connectOnboard = trpc.store.connectOnboard.useMutation({
    onSuccess: result => {
      window.location.href = result.url;
    },
    onError: e => {
      toast.error(e.message);
      navigate("/dashboard");
    },
  });

  const createStore = trpc.store.create.useMutation({
    onSuccess: () => {
      utils.store.mine.invalidate();
      toast.success(
        "Loja criada. Conclua a verificação de CPF no Stripe para publicar anúncios."
      );
      connectOnboard.mutate();
    },
    onError: e => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Store size={40} style={{ color: VIOLET }} />
        <h1
          className="text-2xl font-black"
          style={{ color: INK, fontFamily: "var(--font-display)" }}
        >
          Entre para abrir sua loja
        </h1>
        <a
          href={getLoginUrl()}
          className="text-white font-black rounded-full px-8 py-3 text-sm uppercase"
          style={{ background: VIOLET }}
        >
          Entrar
        </a>
      </div>
    );
  }

  if (myStore.data) {
    const ready =
      myStore.data.stripePayoutsEnabled &&
      !!myStore.data.sellerTermsAcceptedAt &&
      myStore.data.sellerTermsVersion === MARKETPLACE_TERMS_VERSION;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <CheckCircle2 size={40} className="text-emerald-500" />
        <h1
          className="text-2xl font-black"
          style={{ color: INK, fontFamily: "var(--font-display)" }}
        >
          Você já tem uma loja
        </h1>
        <Link
          href={ready ? `/store/${myStore.data.slug}` : "/dashboard"}
          className="text-white font-black rounded-full px-8 py-3 text-sm uppercase"
          style={{ background: VIOLET }}
        >
          {ready
            ? `Ir para ${myStore.data.storeName}`
            : "Concluir verificação de recebimentos"}
        </Link>
      </div>
    );
  }

  const canNext1 = storeName.trim().length >= 3;
  const canNext2 = payments.length > 0;

  const shipsFrom = [shipCity.trim(), shipState].filter(Boolean).join(", ");

  const submit = () => {
    if (!agreed) return toast.error("Aceite os termos do vendedor");
    createStore.mutate({
      storeName: storeName.trim(),
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      paymentMethods: payments,
      shipsFrom: shipsFrom ? `${shipsFrom}, Brasil` : undefined,
      handlingDays,
      shippingPolicy: shippingPolicy.trim() || undefined,
      returnPolicy: returnPolicy.trim() || undefined,
      acceptSellerTerms: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header + progress */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl md:text-3xl font-black"
            style={{ color: INK, fontFamily: "var(--font-display)" }}
          >
            Abra sua loja
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Grátis para abrir. Marketplace exclusivo para vendedores no Brasil.
          </p>
        </div>
        <div className="flex items-start justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-start">
              <div className="flex flex-col items-center w-24">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white transition-colors"
                  style={{ background: step >= s.n ? VIOLET : "#d1d5db" }}
                >
                  {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                </div>
                <span
                  className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-center leading-tight"
                  style={{ color: step >= s.n ? VIOLET : "#9ca3af" }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-12 md:w-20 h-1 rounded mt-4"
                  style={{ background: step > s.n ? VIOLET : "#e5e7eb" }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-5">
              <div
                className="flex items-center gap-2 font-black"
                style={{ color: INK }}
              >
                <Store size={18} style={{ color: VIOLET }} /> Store identity
              </div>
              <div>
                <label className={labelCls}>Store name *</label>
                <input
                  className={inputCls}
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="e.g. Kaique's Card Corner"
                  maxLength={128}
                />
                {storeName && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Your store URL: /store/
                    {storeName
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "")}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Tagline</label>
                <input
                  className={inputCls}
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="Short slogan shown under your store name"
                  maxLength={256}
                />
              </div>
              <div>
                <label className={labelCls}>About your store</label>
                <textarea
                  className={`${inputCls} min-h-[100px]`}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What do you sell? Since when do you collect? Buyers trust sellers with a real story."
                  maxLength={4000}
                />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input
                  className={inputCls}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Cidade, Estado — ex.: São Paulo, SP"
                  maxLength={128}
                />
              </div>
              <div className="flex justify-end">
                <button
                  disabled={!canNext1}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 text-white font-black rounded-full px-7 py-2.5 text-sm uppercase disabled:opacity-40"
                  style={{ background: VIOLET }}
                >
                  Next <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div
                className="flex items-center gap-2 font-black"
                style={{ color: INK }}
              >
                <CreditCard size={18} style={{ color: VIOLET }} /> Pagamentos e
                envio
              </div>

              <div>
                <label className={labelCls}>
                  Formas de pagamento seguras *
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {PAYMENT_OPTIONS.map(opt => {
                    const active = payments.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`text-left border rounded-xl p-3.5 transition-all ${active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <div
                          className="flex items-center gap-2 font-bold text-sm"
                          style={{ color: INK }}
                        >
                          <span style={{ color: VIOLET }}>{opt.icon}</span>{" "}
                          {opt.label}
                          {"recommended" in opt && opt.recommended && (
                            <span className="text-[9px] font-black bg-[#F5B301] text-black rounded-full px-1.5 py-px uppercase">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-2.5">
                <Truck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <span className="font-black uppercase">
                    Envio nacional — Brasil
                  </span>
                  <p className="mt-0.5">
                    Todo anúncio público inclui frete rastreado no preço e deve
                    atender endereços no Brasil.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Cidade de origem</label>
                  <input
                    className={inputCls}
                    value={shipCity}
                    onChange={e => setShipCity(e.target.value)}
                    placeholder="Ex.: Campinas"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select
                    className={inputCls}
                    value={shipState}
                    onChange={e => setShipState(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {BR_STATES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Handling time (days)</label>
                  <select
                    className={inputCls}
                    value={handlingDays}
                    onChange={e => setHandlingDays(parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 7, 10].map(d => (
                      <option key={d} value={d}>
                        {d} {d === 1 ? "day" : "days"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  <Truck size={12} className="inline mr-1" />
                  Shipping policy
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px]`}
                  value={shippingPolicy}
                  onChange={e => setShippingPolicy(e.target.value)}
                  maxLength={4000}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <ShieldCheck size={12} className="inline mr-1" />
                  Return policy
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px]`}
                  value={returnPolicy}
                  onChange={e => setReturnPolicy(e.target.value)}
                  maxLength={4000}
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 font-black text-sm text-gray-500 hover:text-gray-800 uppercase"
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  disabled={!canNext2}
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 text-white font-black rounded-full px-7 py-2.5 text-sm uppercase disabled:opacity-40"
                  style={{ background: VIOLET }}
                >
                  Next <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div
                className="flex items-center gap-2 font-black"
                style={{ color: INK }}
              >
                <CheckCircle2 size={18} style={{ color: VIOLET }} /> Review &
                confirm
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <div>
                  <span className="font-bold">Store:</span> {storeName}
                  {tagline && (
                    <span className="text-gray-500"> — {tagline}</span>
                  )}
                </div>
                {location && (
                  <div>
                    <span className="font-bold">Location:</span> {location}
                  </div>
                )}
                <div>
                  <span className="font-bold">Payments:</span>{" "}
                  {payments
                    .map(p => PAYMENT_OPTIONS.find(o => o.value === p)?.label)
                    .join(", ")}
                </div>
                <div>
                  <span className="font-bold">Handling:</span> ships in{" "}
                  {handlingDays} {handlingDays === 1 ? "day" : "days"}
                  {shipsFrom && ` from ${shipsFrom}`}
                </div>
                <div>
                  <span className="font-bold">Entrega:</span> todo o Brasil, com
                  rastreamento incluído
                </div>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-900 leading-relaxed">
                <div className="flex items-center gap-1.5 font-black uppercase mb-1">
                  <LockKeyhole size={13} /> Termos do vendedor
                </div>
                Abrir a loja é grátis. A comissão da plataforma é de 5% sobre
                pagamentos concluídos por cartão ou Pix. O saldo fica protegido
                e é liberado conforme o fluxo do pedido. O vendedor deve usar
                dados brasileiros válidos, incluir frete rastreado no preço,
                descrever corretamente o estado do item e cumprir a legislação
                brasileira de consumo.
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-violet-600 w-4 h-4"
                />
                <span>
                  Concordo com os{" "}
                  <Link
                    href="/terms"
                    className="font-bold text-violet-700 hover:underline"
                  >
                    termos do vendedor
                  </Link>{" "}
                  e confirmo que meus anúncios serão verdadeiros.
                </span>
              </label>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 font-black text-sm text-gray-500 hover:text-gray-800 uppercase"
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  disabled={
                    !agreed || createStore.isPending || connectOnboard.isPending
                  }
                  onClick={submit}
                  className="inline-flex items-center gap-2 text-white font-black rounded-full px-8 py-3 text-sm uppercase disabled:opacity-40 shadow-lg"
                  style={{
                    background: "linear-gradient(120deg, #7C3AED, #FF2E9A)",
                  }}
                >
                  {createStore.isPending || connectOnboard.isPending
                    ? "Conectando ao Stripe..."
                    : "Abrir loja e verificar CPF"}{" "}
                  <Store size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <LockKeyhole size={12} /> Pagamentos processados pelo Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} /> Proteção em todos os pedidos
          </span>
          <span className="flex items-center gap-1.5">
            <Truck size={12} /> Envio para todo o Brasil
          </span>
        </div>
      </div>
    </div>
  );
}
