# RarityGrid Drop Monitor

## What is implemented

The legacy `/drops` page only stored a product label. The new engine adds:

- product discovery and exact-URL monitors;
- normal and release-window polling modes;
- a five-second configurable burst inside release windows;
- an HMAC-signed event webhook for lower latency than polling;
- per-product state, so a listing alerts once when new and again only after a
  real out-of-stock to in-stock transition;
- a silent first baseline for discovery searches, preventing old in-stock
  listings from flooding a newly created monitor;
- price ceilings, saved handoff quantity and URL/domain validation;
- idempotent events and visible detection latency;
- a persistent event outbox that retries notifications left unfinished by a
  crash or rolling deploy;
- in-app, email, Discord, Telegram and standards-based Web Push delivery;
- iPhone Home Screen PWA push support;
- a scoped, revocable, 90-day iPhone Shortcut companion token;
- an optional standalone Railway worker.

The application does **not** scrape retailer pages directly and never stores a
retailer password, payment method or session cookie.

## Retailers

The normalized provider contract supports these tiers:

1. Major: Walmart, Target, Pokémon Center, Amazon, Best Buy and GameStop.
2. Warehouse/regional: Costco, Sam's Club, BJ's, Meijer, Barnes & Noble,
   SCHEELS, Walgreens, CVS Pharmacy, Dollar General and Five Below.
3. TCG specialists: Game Nerdz, Smoke & Mirrors Hobby, Forge & Fire Gaming and
   Safari Zone Collectibles.
4. Marketplaces: TCGplayer and eBay.
5. Brazil: Amazon Brasil, Mercado Livre, Loja Copag, Ri Happy, PBKids, Liga
   Pokémon and Epic Game.

Supporting a retailer in the RarityGrid contract does not imply that a selected
inventory provider covers it. The UI must show `providerConnected`; provider
coverage must be verified during homologation.

Declare verified coverage in `DROP_PROVIDER_RETAILERS` using comma-separated
IDs from `shared/drops.ts`. Green dots in `/drops` mean declared provider
coverage; gray dots mean the adapter is ready but that source is not confirmed.
The worker stays disabled when this list is empty.

Brazilian retailers default to `BRL` and `America/Sao_Paulo`; US retailers
default to `USD` and `America/New_York`. Price ceilings never compare values
across currencies.

## Authorized provider contract

Set `DROP_PROVIDER_URL` to the provider's complete HTTPS search endpoint. The
worker calls it with:

```http
GET {DROP_PROVIDER_URL}?retailer=walmart&q=ascended%20heroes&url=https%3A...
Authorization: Bearer {DROP_PROVIDER_API_KEY}
Accept: application/json
```

Expected response (maximum 100 products):

```json
{
  "requestId": "provider-request-id",
  "products": [
    {
      "retailer": "walmart",
      "retailerProductId": "123456789",
      "title": "Pokémon TCG Ascended Heroes Elite Trainer Box",
      "productUrl": "https://www.walmart.com/ip/123456789",
      "imageUrl": "https://images.example/etb.webp",
      "stockState": "in_stock",
      "priceCents": 5499,
      "currency": "USD",
      "observedAt": "2026-08-21T21:00:00.000Z",
      "source": "licensed-feed"
    }
  ]
}
```

Allowed stock states: `unknown`, `out_of_stock`, `in_stock`, `preorder`.
Product URLs are accepted only when their HTTPS hostname matches the selected
retailer.

Create discovery monitors before the expected launch window. Their first check
captures the current catalog silently; exact-URL monitors alert immediately if
that one product is already live. A maximum price only passes when the provider
returns a known price in the monitor's configured currency.

## Event webhook (fastest path)

POST the same JSON payload to:

```text
POST https://raritygrid.com/api/drop-provider/webhook
Content-Type: application/json
X-RarityGrid-Timestamp: <unix-seconds>
X-RarityGrid-Signature: sha256=<hex-hmac>
```

The signature is:

```text
HMAC-SHA256(DROP_PROVIDER_WEBHOOK_SECRET, timestamp + "." + raw_request_body)
```

Requests outside a five-minute clock window, bad signatures, cross-retailer
URLs and oversized batches are rejected. A webhook can alert immediately; the
five-second burst is the polling fallback.

## Release windows

The first user query seeds one editable default:

- Walmart;
- Wednesday;
- 8:55 PM–9:15 PM;
- `America/New_York`;
- five-second target interval.

This is a user-configured hypothesis, not a permanent statement about Walmart's
schedule. Add a separate window for every observed retailer/day/time pattern.
Outside a window, `always` monitors use `DROP_NORMAL_INTERVAL_SECONDS` and
`release_windows` monitors sleep.

## Web Push and iPhone

Generate VAPID keys once:

```bash
node scripts/generate-vapid-keys.mjs
```

Store the printed values only in Railway variables. On iPhone/iPad, Web Push
requires iOS/iPadOS 16.4 or newer, adding RarityGrid to the Home Screen and
granting notifications from the installed PWA. The service worker opens the
verified retailer URL when the notification is tapped.

## iPhone Shortcut companion

From `/drops`, generate an `iPhone Shortcut` token. It is shown once, stored only
as a SHA-256 hash and expires after 90 days.

Create a Personal Automation in Shortcuts:

1. Trigger: Time of Day, for example Wednesday at 8:59 PM.
2. Action: Get Contents of URL.
3. URL: `https://raritygrid.com/api/drop-companion/next`.
4. Header: `Authorization` = `Bearer YOUR_TOKEN`.
5. Read the JSON response.
6. If `available` is true, show `title` and open `productUrl`.
7. Store `eventId` and send it as `?after=EVENT_ID` on the next request to avoid
   reopening the same event.

Shortcuts does not provide a general remote webhook trigger. Web Push is the
immediate trigger; the Shortcut is useful for scheduled preparation, retrieving
the newest event and opening the product. Remote execution would require a
native iOS app/APNs or a third-party automation server such as Pushcut.

Official platform references:

- [Web Push for Home Screen web apps on iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple Personal Automations in Shortcuts](https://support.apple.com/guide/shortcuts/apd690170742/ios)

## Cart automation boundary

`handoffMode` is fixed to `open_product`. The engine deliberately does not:

- click Add to cart on an unapproved retailer;
- bypass a queue, CAPTCHA, rate limit, purchase limit or bot defense;
- automate checkout or submit an order;
- share or centrally store retailer credentials.

Target's April 2026 terms allow only Target-approved Agentic Commerce Agents and
explicitly prohibit other automated agents. Walmart also prohibits automated
navigation and publicly states that it detects purchase bots. Pokémon Center
uses bot-detection cookies. `autoCart.enabled` therefore remains false until the
specific retailer grants delegated/API access. User consent alone is not
retailer authorization.

Policy references used for this boundary:

- [Target Terms & Conditions](https://www.target.com/c/terms-conditions/-/N-4sr7l)
- [Walmart Terms of Use](https://corporate.walmart.com/terms-of-use)
- [Walmart statement on purchase bots](https://corporate.walmart.com/news/2020/12/15/doing-our-part-to-ensure-customers-not-grinch-bots-can-buy-this-seasons-hottest-items)
- [Pokémon Center bot-detection cookie disclosure](https://www.pokemoncenter.com/cookies)

## Railway layout

### Single-service MVP

Run the normal web service with `DROP_WORKER_ENABLED=true`.

### Recommended production layout

Use two Railway services from the same repository:

- Web: `pnpm start`, `DROP_WORKER_ENABLED=false`.
- Drop worker: `pnpm start:drop-worker`, `DROP_WORKER_ENABLED=true`.

Both share the same MySQL database and provider variables. The webhook remains
on the web service. A database lease elects one polling worker; shared provider
queries are coalesced, and event fingerprints plus product-state transitions
prevent duplicate notifications during a rolling deploy.

Each tick executes at most five unique provider queries concurrently. Identical
rules share one query across users, so burst latency does not grow linearly with
the number of subscribers.

## Required variables

```text
DROP_PROVIDER_URL
DROP_PROVIDER_API_KEY
DROP_PROVIDER_RETAILERS
DROP_PROVIDER_WEBHOOK_SECRET
DROP_WORKER_ENABLED
DROP_NORMAL_INTERVAL_SECONDS
DROP_BURST_INTERVAL_SECONDS
DROP_VAPID_PUBLIC_KEY
DROP_VAPID_PRIVATE_KEY
DROP_VAPID_SUBJECT
```

Optional shared alert channels:

```text
DROP_DISCORD_WEBHOOK_URL
DROP_TELEGRAM_BOT_TOKEN
DROP_TELEGRAM_CHAT_ID
RESEND_API_KEY
```

## Homologation gate

Do not call the monitor live until all of these pass:

- provider coverage confirmed retailer by retailer;
- exact product URL and search discovery tested;
- out-of-stock → in-stock transition produces one event;
- repeated in-stock samples do not duplicate an event;
- price ceiling suppresses an expensive offer;
- webhook signature, timestamp and idempotent replay behavior tested;
- Discord/Telegram/PWA push opens the correct HTTPS retailer domain;
- iPhone PWA tested from a locked screen;
- Shortcut token creation, expiration and revocation tested;
- Railway web/worker rolling deploy does not double-alert;
- observed-to-detected and detected-to-notified latency recorded during a real
  launch window.
