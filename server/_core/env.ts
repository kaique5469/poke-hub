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
  /** Directory for uploaded/generated files (mount a Railway volume here). */
  dataDir: process.env.DATA_DIR ?? "./data",
  /** Optional key for CardMarket price API via RapidAPI. */
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
  /** Server-only Scrydex credentials for real sealed products and USD prices. */
  scrydexApiKey: process.env.SCRYDEX_API_KEY ?? "",
  scrydexTeamId: process.env.SCRYDEX_TEAM_ID ?? "",
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
