# RarityGrid app shell (`/app`)

Mobile-first product surface for collectors who buy, sell and trade — in
Brazil and in the US. It lives inside the same Vite client and talks to the
same tRPC server as the website; nothing is duplicated.

## Routes

| Path | Tab | What it does |
| --- | --- | --- |
| `/app` | Home | Scan CTA, collection value, recent scans, market movers |
| `/app/scan` | Scan | Continuous camera, auto-capture when the phone is steady, batch queue, review sheet (variant with price, condition, quantity, paid), collect |
| `/app/collection` | Collection | Grid 2/3 columns, search, set/condition filters, sort; edit/remove in a sheet |
| `/app/portfolio` | Portfolio | Value in USD **and** BRL, 7d change, history chart, cost vs. gain, movers |
| `/app/alerts` | Alerts | Drop monitors (BR + US retailers), push opt-in, recent detections |
| `/app/settings` | — | Language (pt-BR/en), currency (USD/BRL), install, account |

`server/seo.ts` lists `/app` as a client route and a private (noindex) path.
The PWA manifest starts at `/app` with Scan / Portfolio / Alerts shortcuts.

## Product rules encoded here

- **First scan before any sign-up.** Anonymous scans are allowed
  (`SCANNER_QUOTAS.anonymousPerDay` per IP). Collected cards wait in
  `localStorage` and are merged by `binder.addMany` on sign-in
  (idempotent on `clientId`).
- **Variant is a first-class field.** `binder_cards.variant` stores
  normal / holofoil / reverseHolofoil / 1stEdition… and prices are looked
  up per variant (`getVariantPrice`). The scanner returns `variantPrices`
  for every match so the review sheet shows why it matters.
- **Two currencies, one source of truth.** Prices are stored in USD. BRL is
  derived from the daily ECB reference rate (`server/lib/fx.ts`,
  Frankfurter, 12 h cache, last-known-good in `external_api_cache`,
  hard fallback 5.50) and labelled as an estimate. Real Brazilian market
  prices (Liga Pokémon) are a later phase.
- **All filters are free.** Pro features (price history beyond 30 days,
  alerts, exports, AI grading) are gated where they are touched, never on
  launch.

## Schema

`server/appSchema.ts` self-bootstraps at boot (Railway runs no migrations):

- `users.locale`, `users.currency`
- `binder_cards.variant`, `binder_cards.clientId` (+ index)

Mirrored in `drizzle/schema.ts`.

## Analytics

`client/src/app/analytics.ts` emits the activation funnel
(`app_open`, `scan_started`, `scan_success`, `scan_failed`, `card_collected`,
`signup_prompt_clicked`, `pending_merged`, `alert_created`, `push_enabled`).
It forwards to PostHog when `window.posthog` exists; add the snippet to
`client/index.html` with the project key to turn it on.

## Not in this slice (next PRs)

- Capacitor wrappers for App Store / Google Play (bearer-token auth for
  the native WebView).
- Pro subscription (Stripe on web, RevenueCat in stores) and the paywall
  surfaces.
- Live stock provider for drop monitors (TinyFish / Nimble prototype,
  then a licensed feed) and community "found it" reports.
- Embedding-based recognition to replace per-scan AI cost.
- BRL market prices from Brazilian marketplaces.
