import { isDropRetailer } from "../../shared/drops";

export const ENV = {
  /** MySQL connection string, e.g. mysql://user:pass@host:3306/db */
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Secret used to sign session JWTs. Required in production. */
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  /** Google OAuth (optional — email/password works without it) */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** Public URL of the app (for OAuth callbacks), e.g. https://pokehub.up.railway.app */
  appUrl: process.env.APP_URL ?? "",
  /** OpenAI API key — optional. Enables AI articles, covers, and card scans. */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** Cost-controlled multimodal model used only by the card scanner. */
  openaiScannerModel: process.env.OPENAI_SCANNER_MODEL ?? "gpt-5-mini",
  /** Secret required by scheduled endpoints (x-cron-secret header). */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Email of the site owner — this account becomes admin on registration. */
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  /** Public support address. Falls back to the owner while the brand inbox is set up. */
  supportEmail: process.env.SUPPORT_EMAIL ?? process.env.OWNER_EMAIL ?? "",
  /** Optional Resend delivery. Without it, messages are safely logged. */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom:
    process.env.EMAIL_FROM ?? "RarityGrid <notifications@raritygrid.com>",
  /** Directory for uploaded/generated files (mount a Railway volume here). */
  dataDir: process.env.DATA_DIR ?? "./data",
  /** Optional key for CardMarket price API via RapidAPI. */
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
  /** Optional commercial catalog with Japanese cards and PSA 1-10 sold comps. */
  tcgPriceLookupApiKey: process.env.TCG_PRICE_LOOKUP_API_KEY ?? "",
  /** Server-only Scrydex credentials for real sealed products and USD prices. */
  scrydexApiKey: process.env.SCRYDEX_API_KEY ?? "",
  scrydexTeamId: process.env.SCRYDEX_TEAM_ID ?? "",
  /**
   * Authorized inventory provider. Retailer pages are never scraped directly
   * by this application. The provider must return the normalized contract
   * documented in docs/DROP_MONITOR.md.
   */
  dropProviderUrl: process.env.DROP_PROVIDER_URL ?? "",
  dropProviderApiKey: process.env.DROP_PROVIDER_API_KEY ?? "",
  dropProviderRetailers: (process.env.DROP_PROVIDER_RETAILERS ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(isDropRetailer),
  dropProviderWebhookSecret: process.env.DROP_PROVIDER_WEBHOOK_SECRET ?? "",
  dropWorkerEnabled: process.env.DROP_WORKER_ENABLED !== "false",
  dropNormalIntervalSeconds: Math.max(
    30,
    Number.parseInt(process.env.DROP_NORMAL_INTERVAL_SECONDS ?? "300", 10) ||
      300
  ),
  dropBurstIntervalSeconds: Math.max(
    3,
    Number.parseInt(process.env.DROP_BURST_INTERVAL_SECONDS ?? "5", 10) || 5
  ),
  /** Fast shared channels for the owner's private drop group. */
  dropDiscordWebhookUrl: process.env.DROP_DISCORD_WEBHOOK_URL ?? "",
  dropTelegramBotToken: process.env.DROP_TELEGRAM_BOT_TOKEN ?? "",
  dropTelegramChatId: process.env.DROP_TELEGRAM_CHAT_ID ?? "",
  dropVapidPublicKey: process.env.DROP_VAPID_PUBLIC_KEY ?? "",
  dropVapidPrivateKey: process.env.DROP_VAPID_PRIVATE_KEY ?? "",
  dropVapidSubject:
    process.env.DROP_VAPID_SUBJECT ??
    `mailto:${process.env.SUPPORT_EMAIL ?? process.env.OWNER_EMAIL ?? "support@raritygrid.com"}`,
  isProduction: process.env.NODE_ENV === "production",
};

// Hard-fail: never run production with a missing/default JWT secret —
// anyone could forge session tokens (including admin).
if (
  ENV.isProduction &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-me")
) {
  throw new Error("JWT_SECRET é obrigatório em produção (defina no Railway).");
}
