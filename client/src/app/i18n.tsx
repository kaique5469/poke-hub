/**
 * Minimal i18n for the app shell. Two dictionaries, one hook, no library:
 * strings are keyed by English source text so missing translations fall
 * back to readable English instead of a key like `scan.cta`.
 */
import { createContext, useCallback, useContext, useMemo } from "react";
import type { AppLocale } from "@shared/app";

type Dict = Record<string, string>;

const ptBR: Dict = {
  // Tabs
  "Home": "Início",
  "Collection": "Coleção",
  "Scan": "Escanear",
  "Portfolio": "Portfólio",
  "Alerts": "Alertas",
  "Settings": "Ajustes",

  // Generic
  "Sign in": "Entrar",
  "Create account": "Criar conta",
  "Sign out": "Sair",
  "Save": "Salvar",
  "Cancel": "Cancelar",
  "Done": "Concluir",
  "Remove": "Remover",
  "Edit": "Editar",
  "Retry": "Tentar de novo",
  "Loading…": "Carregando…",
  "Search": "Buscar",
  "See all": "Ver tudo",
  "Close": "Fechar",
  "Back": "Voltar",
  "Open website": "Abrir o site",
  "Yes": "Sim",
  "No": "Não",

  // Home
  "Scan a card": "Escanear carta",
  "Point the camera at a card to see its value in seconds.":
    "Aponte a câmera para uma carta e veja o valor em segundos.",
  "Your collection": "Sua coleção",
  "cards": "cartas",
  "card": "carta",
  "On this phone": "Neste aparelho",
  "card waiting to be saved": "carta esperando para ser salva",
  "Recent scans": "Scans recentes",
  "Trending today": "Em alta hoje",
  "Biggest moves in the market this week.":
    "Maiores movimentos do mercado nesta semana.",
  "Nothing scanned yet": "Nada escaneado ainda",
  "Your first scan takes about five seconds.":
    "Seu primeiro scan leva uns cinco segundos.",
  "cards waiting to be saved": "cartas esperando para serem salvas",
  "Create a free account to keep them.":
    "Crie uma conta grátis para guardá-las.",
  "Save my cards": "Salvar minhas cartas",

  // Scanner
  "Fit the card inside the frame": "Encaixe a carta dentro da moldura",
  "Hold still…": "Segure firme…",
  "Identifying…": "Identificando…",
  "Camera unavailable": "Câmera indisponível",
  "Allow camera access to scan cards, or pick a photo from your gallery.":
    "Permita o acesso à câmera para escanear, ou escolha uma foto da galeria.",
  "Choose photo": "Escolher foto",
  "Capture": "Capturar",
  "Auto": "Auto",
  "Manual": "Manual",
  "Queue": "Fila",
  "Review": "Revisar",
  "Not this card": "Não é essa",
  "Search manually": "Buscar manualmente",
  "Variant": "Variante",
  "Condition": "Condição",
  "Quantity": "Quantidade",
  "Paid": "Pago",
  "Paid (optional)": "Pago (opcional)",
  "Add to collection": "Adicionar à coleção",
  "Added to collection": "Adicionada à coleção",
  "Scan another": "Escanear outra",
  "Save all": "Salvar todas",
  "Could not identify this card. Try better light or search by name.":
    "Não deu para identificar esta carta. Tente com mais luz ou busque pelo nome.",
  "Too many scans at once. Wait a minute.":
    "Muitos scans de uma vez. Espere um minuto.",
  "Daily scan limit reached. Create a free account for a bigger daily budget.":
    "Limite diário de scans atingido. Crie uma conta grátis para ter um limite maior.",
  "Daily scan limit reached. Try again tomorrow.":
    "Limite diário de scans atingido. Tente de novo amanhã.",
  "The scanner is unavailable right now.":
    "O scanner está indisponível no momento.",
  "scans left today": "scans restantes hoje",
  "Match": "Correspondência",
  "Strong match": "Correspondência forte",
  "Likely match": "Provável",
  "Check carefully": "Confira com atenção",
  "Saved on this phone until you sign in.":
    "Salvo neste aparelho até você entrar.",
  "Price for this variant": "Preço desta variante",
  "No price for this variant yet": "Ainda sem preço para esta variante",
  "Estimated from exchange rate": "Estimado pelo câmbio",

  // Variants
  "Normal": "Normal",
  "Holofoil": "Holo",
  "Reverse holo": "Reverse",
  "1st edition holo": "1ª edição holo",
  "1st edition": "1ª edição",
  "Promo": "Promo",

  // Conditions
  "Mint": "Mint",
  "Near mint": "Near mint",
  "Slightly played": "Pouco jogada",
  "Moderately played": "Jogada",
  "Heavily played": "Muito jogada",
  "Damaged": "Danificada",

  // Collection
  "Search your cards": "Buscar nas suas cartas",
  "All sets": "Todos os sets",
  "All conditions": "Todas as condições",
  "Sort": "Ordenar",
  "Newest": "Mais recentes",
  "Highest value": "Maior valor",
  "Name": "Nome",
  "Your collection is empty": "Sua coleção está vazia",
  "Scan your first card and it shows up here.":
    "Escaneie sua primeira carta e ela aparece aqui.",
  "Sign in to see your collection": "Entre para ver sua coleção",
  "Your cards sync across devices once you sign in.":
    "Suas cartas sincronizam entre aparelhos depois que você entra.",
  "Qty": "Qtd",
  "Market": "Mercado",
  "No price yet": "Ainda sem preço",
  "Removed from collection": "Removida da coleção",
  "Saved": "Salvo",
  "Sell": "Vender",
  "Sell this card": "Vender esta carta",
  "Open card page": "Abrir página da carta",

  // Portfolio
  "Collection value": "Valor da coleção",
  "last 7 days": "últimos 7 dias",
  "Cost": "Custo",
  "Gain": "Ganho",
  "Loss": "Perda",
  "Top gainers": "Maiores altas",
  "Top losers": "Maiores quedas",
  "Most valuable": "Mais valiosas",
  "Priced": "Com preço",
  "of": "de",
  "No price history yet": "Ainda sem histórico",
  "Values are refreshed daily from market data.":
    "Os valores são atualizados diariamente com dados de mercado.",
  "Add what you paid to see your real gain.":
    "Informe o que pagou para ver o ganho real.",

  // Alerts
  "Restock alerts": "Alertas de reestoque",
  "Get a push the moment a sealed product is back in stock.":
    "Receba um aviso no momento em que um produto selado volta ao estoque.",
  "Watching": "Monitorando",
  "New alert": "Novo alerta",
  "Product name": "Nome do produto",
  "Retailer": "Loja",
  "Enable notifications": "Ativar notificações",
  "Notifications on": "Notificações ativas",
  "No alerts yet": "Nenhum alerta ainda",
  "Add a product you want and we tell you when it is back.":
    "Adicione um produto que você quer e avisamos quando voltar.",
  "Recent drops": "Últimos reestoques",
  "Sign in to arm alerts": "Entre para criar alertas",
  "Alerts need an account so we can reach you.":
    "Alertas precisam de uma conta para a gente te avisar.",
  "Manage all alerts on the website": "Gerenciar todos os alertas no site",
  "Brazil": "Brasil",
  "United States": "Estados Unidos",
  "Live stock data is not connected yet; alerts arm and wait.":
    "Os dados de estoque ao vivo ainda não estão conectados; os alertas ficam armados aguardando.",

  // Pro
  "Everything for collectors who buy, sell and trade.":
    "Tudo para quem coleciona, compra, vende e troca.",
  "Unlimited scans": "Scans ilimitados",
  "Full price history": "Histórico de preço completo",
  "Export your collection (CSV)": "Exportar sua coleção (CSV)",
  "Instant restock push": "Aviso de reestoque na hora",
  "Priority support": "Suporte prioritário",
  "Monthly": "Mensal",
  "Yearly": "Anual",
  "mo": "mês",
  "yr": "ano",
  "Save {pct}%": "Economize {pct}%",
  "Get Pro": "Assinar o Pro",
  "Pro is almost ready. Everything free stays free.":
    "O Pro está quase pronto. Tudo que é grátis continua grátis.",
  "Cancel anytime. Prices in BRL are charged in BRL.":
    "Cancele quando quiser. Preços em BRL são cobrados em BRL.",
  "You are Pro": "Você é Pro",
  "Manage subscription": "Gerenciar assinatura",
  "Welcome to Pro!": "Bem-vindo ao Pro!",
  "Checkout cancelled": "Pagamento cancelado",
  "Export CSV": "Exportar CSV",
  "Renews": "Renova em",
  "Daily scan limit reached. Pro has unlimited scans.":
    "Limite diário de scans atingido. O Pro tem scans ilimitados.",

  // Settings
  "Language": "Idioma",
  "Currency": "Moeda",
  "Account": "Conta",
  "Signed in as": "Conectado como",
  "Prices in BRL are converted from USD at the daily reference rate.":
    "Preços em BRL são convertidos do USD pela taxa de referência do dia.",
  "Rate": "Câmbio",
  "Install the app": "Instalar o app",
  "Add RarityGrid to your home screen for one-tap scanning.":
    "Adicione o RarityGrid à tela inicial para escanear com um toque.",
  "About": "Sobre",
  "Privacy": "Privacidade",
  "Terms": "Termos",
  "Contact": "Contato",
};

const en: Dict = {};

const DICTS: Record<AppLocale, Dict> = { "pt-BR": ptBR, en };

type I18nValue = {
  locale: AppLocale;
  t: (text: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: "en",
  t: text => text,
});

function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key])
  );
}

export function I18nProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) =>
      interpolate(DICTS[locale][text] ?? text, vars),
    [locale]
  );
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext).t;
}

/** "1 card" / "2 cards" in the active language. */
export function useCount() {
  const t = useT();
  return (n: number, singular: string, plural: string) =>
    `${n} ${t(n === 1 ? singular : plural)}`;
}

export function useLocale() {
  return useContext(I18nContext).locale;
}

/** Exposed for tests. */
export const __dicts = DICTS;
