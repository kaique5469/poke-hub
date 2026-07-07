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
  /** OpenAI API key — optional. Enables daily AI articles + cover generation. */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** Secret required by scheduled endpoints (x-cron-secret header). */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Email of the site owner — this account becomes admin on registration. */
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  /** Directory for uploaded/generated files (mount a Railway volume here). */
  dataDir: process.env.DATA_DIR ?? "./data",
  /** Optional key for CardMarket price API via RapidAPI. */
  rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
