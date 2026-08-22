# Catalog, graded prices, editorial and SEO audit

Updated: 2026-08-21

## Scope

This phase improves discovery and content. It does not activate or modify the
marketplace checkout, physical inventory or seller operations.

## Catalog and search

- The default English catalog combines the existing PokemonTCG.io and
  CardMarket-compatible sources with a curated historical-card layer.
- TCGdex provides separate Portuguese (Brazil) and Japanese catalog views.
- An optional licensed TCG Price Lookup connection expands English and Japanese
  coverage. Its API key must remain server-side as
  `TCG_PRICE_LOOKUP_API_KEY`.
- Search normalizes accents and punctuation, expands product abbreviations,
  corrects common misspellings and uses fuzzy set matching. Examples covered by
  tests include `Pikachu Ilustrator` and `Cause Rising ETB`.
- Pikachu Illustrator has a verified historical record even when a general card
  API omits it. The record cites Guinness World Records and does not reuse an
  unlicensed card image.

No single public source contains every printing, language and historical promo.
The UI therefore identifies its source and never claims exhaustive coverage.

## PSA values

- Card pages expose selectors for PSA grades 1 through 10.
- A price is shown only when a configured source returns a comp for that exact
  grade. Missing grades are marked unavailable and are never extrapolated.
- The licensed feed can supply PSA, BGS and CGC market observations; this phase
  exposes PSA only, matching the product requirement.
- The Pikachu Illustrator PSA 10 record uses the last verified public auction
  result. CardMarket PSA 9/10 values remain a clearly labelled market-reference
  fallback for supported cards.
- All values are market observations, not official PSA appraisals or guaranteed
  sale prices.

## Editorial automation

- The workflow runs daily so it can recover from missed or duplicate days.
- The server publishes at most one automatic article per run and stops after
  three source-verified articles in the UTC week.
- Each automatic article needs at least two HTTPS sources on different domains,
  including Pokemon.com or a primary tournament source.
- Social video/posts cannot be used as the factual source. Duplicate topics and
  known fabricated legacy titles are quarantined from public article routes.
- Major verified stories can carry the `featured` tag and become the homepage
  hero. When none exists, the home uses an official Pokemon 30th Celebration
  announcement rather than generated news.

## SEO and growth

- Page titles and descriptions now lead with card discovery, PSA observations,
  set data and verified news instead of marketplace sales.
- The historical Pikachu Illustrator page is in the sitemap.
- `llms.txt` documents public sections and the site's data/citation policy.
- Search corrections are announced accessibly, card images have safe fallbacks,
  and the article index exposes retry/error states instead of looking empty.

## Operations before production

1. Add `TCG_PRICE_LOOKUP_API_KEY` to Railway only after approving a commercial
   API plan. Do not put the key in Git, client code or support messages.
2. Keep the existing daily editorial workflow enabled and monitor rejected
   source-validation runs. A missed article is safer than invented news.
3. After deployment, test the public examples above and inspect the home hero on
   desktop and mobile.
4. Review provider licensing and attribution whenever a catalog or price source
   changes its terms.
