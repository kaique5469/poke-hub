# PokéHub USA — Project TODO

## Foundation
- [x] Design system: dark theme, color palette (deep navy + gold accent), typography (Inter + display font)
- [x] Global CSS variables, animations, and utility classes
- [x] Database schema: users, binder_cards, decks, deck_cards, drop_alerts
- [x] Server-side API lib: pokemontcg.io, TCGPlayer prices, eBay affiliate, Limitless TCG
- [x] tRPC routers: cards, binder, decks, tournaments, drops, players

## Layout & Navigation
- [x] Top navigation bar with logo, links, search, auth button
- [x] Mobile responsive hamburger menu
- [x] Footer with links and affiliate disclaimer

## Page: Homepage
- [x] Hero section with animated background and CTA
- [x] Trending cards carousel (live data from pokemontcg.io)
- [x] Top metagame decks preview (from Limitless TCG)
- [x] Upcoming tournaments widget

## Page: Card Database (/cards)
- [x] Paginated card grid (24 per page)
- [x] Search by card name
- [x] Filters: set, type, rarity, supertype
- [x] Rare card badges (✦ for SIR/Special Illustration Rare)
- [x] Skeleton loaders
- [x] Card count display

## Page: Card Detail (/cards/:id)
- [x] Full card image (large)
- [x] Card info: HP, type, rarity, set, illustrator, number
- [x] Price section: TCGPlayer (low/mid/high/market), eBay BIN
- [x] Price history chart (Recharts)
- [x] Affiliate links: TCGPlayer, eBay, CardMarket
- [x] Add to Binder button (auth required)
- [x] Open Graph SEO metadata
- [x] Breadcrumb navigation

## Page: Metagame Dashboard (/metagame)
- [x] Top decks table ranked by tournament usage %
- [x] Trend chart (Recharts bar/line)
- [x] Filters: format, region, time period
- [x] Featured decklist modal/drawer
- [x] Meta share percentages

## Page: Deck Builder (/decks/builder)
- [x] Card search panel (left sidebar)
- [x] Deck canvas (right panel) with 60-card slots
- [x] Card count validation (Pokémon/Trainer/Energy breakdown)
- [x] Format legality check (Standard/Expanded)
- [x] Estimated USD cost via TCGPlayer prices
- [x] Save deck (auth required)
- [x] Export deck (text format, PTCGL format)
- [x] Import deck from text

## Page: My Decks (/decks)
- [x] List of saved decks with cost and format
- [x] Edit / Delete / Share deck actions
- [x] Public deck URL

## Page: Tournament Results (/tournaments)
- [x] Completed tournaments table with date, name, players, winner
- [x] Upcoming tournaments calendar widget
- [x] Filters: format, region, date range
- [x] Tournament detail page with Top 8 decklists
- [x] Player standings table

## Page: Binder / Collection (/binder)
- [x] Auth-protected page
- [x] Add cards to binder with quantity and condition
- [x] Remove / update cards
- [x] Total portfolio value in USD (TCGPlayer market price)
- [x] Skeleton loaders
- [x] Batch price fetch

## Page: Drop Alerts (/drops)
- [x] Alert creation form (product name, retailer, notification preference)
- [x] Monitored retailers: Pokémon Center, Amazon, Target
- [x] Browser push notification setup (Web Push API)
- [x] Active alerts list with toggle on/off
- [x] Auth required for saving alerts

## Page: Player Profile (/players/:username)
- [x] Public shareable URL
- [x] User avatar and display name
- [x] Tournament history table
- [x] Saved decks list (public ones)
- [x] Binder summary (total cards, total value)
- [x] Edit profile (auth, own profile only)

## Page: TCG Sets (/sets)
- [x] Sets organized by series
- [x] Set logo, name, year, card count
- [x] Link to card listing filtered by set

## Testing
- [x] Vitest: binder CRUD procedures
- [x] Vitest: deck validation logic
- [x] Vitest: auth logout (existing)

## Redesign v2 — Liga Pokémon Style

- [x] Nova paleta de cores e design tokens (deep dark + yellow/gold premium)
- [x] Nova Navbar com mega-menu dropdown (Loja, Cards, Ferramentas, Comunidade)
- [x] Homepage redesenhada: banner hero full-width, produtos em destaque, cards em alta, seção Pokédex
- [x] Marketplace: listagem de produtos com categorias (Booster Boxes, ETBs, Blisters, Singles, Acessórios)
- [x] Página de produto individual com imagens, preço, links afiliados
- [x] Pokédex browser page com grid de Pokémon e filtros
- [x] Ícones premium SVG para todas as seções
- [x] PokéCard component com hover 3D effect e shine
- [x] Footer redesenhado com categorias de loja e links
- [x] Seção "Hot Cards" com badges de preço na homepage

## Pokémon Detail Page (/pokedex/:id)
- [x] Backend: tRPC procedure pokemon.getDetail (PokeAPI — stats, types, abilities, evolutions, sprites)
- [x] Backend: tRPC procedure pokemon.getTCGCards (pokemontcg.io — all cards for a given Pokémon name)
- [x] Frontend: PokemonDetail page with hero section (large artwork, types, base info)
- [x] Frontend: Base stats bar chart (HP, Attack, Defense, Sp.Atk, Sp.Def, Speed)
- [x] Frontend: Evolution chain visual with arrows and level/condition labels
- [x] Frontend: TCG card gallery grid with price badges and affiliate links
- [x] Frontend: Abilities section with descriptions
- [x] Wire /pokedex/:id route in App.tsx and link from Pokédex grid

## New Features — July 4
- [x] Featured TCG cards carousel at top of Pokémon detail page (sorted by price/rarity)
- [x] Real auction bids backend (place bid, bid history, live polling every 30s)
- [x] Article detail page with full content, author info and comments
- [x] Sell a Card flow — 3-step listing form (search card, set price/condition, success)

## Follow-up Improvements
- [x] ArticleDetail: fetch real author name from users table and render instead of hardcoded placeholder
- [x] ArticleDetail: improve markdown renderer to handle fenced code blocks properly

## Where to Buy — Store Listings on Card Detail Pages
- [x] Audit CardDetail page to understand current affiliate link structure
- [x] Build WhereToBuy component: TCGPlayer listings (price tiers + direct buy link), eBay BIN listings (live search link), CardMarket link, Amazon search link
- [x] Show store logos, price, condition, and direct "Buy" CTA button for each store
- [x] Add to CardDetail page below the price section

## Where to Buy — LigaPokemon-style Table Redesign
- [x] Replace store card grid with a price-sorted table: logo | card name+variant | price | condition | qty | Buy + Visit Store buttons
- [x] Sort rows by price ascending (cheapest first)
- [x] Show condition badge (NM, LP, etc.) and foil/variant tags per row
- [x] Keep TCGPlayer price tiers summary in the left sidebar price card

## Homepage — Live News Feed
- [x] New Sets section: fetch 8 most recent sets from pokemontcg.io with set logo, release date, card count
- [x] Featured Articles section: pull latest 4 articles from DB with Pokémon art and excerpt
- [x] Hot Cards section: show top Special Illustration Rare / Hyper Rare cards with art and price
- [x] TCG News feed: curated news items with Pokémon art (top story + 3 smaller cards)
- [x] Hero banner: rotating banner — newest set logo + Live Auctions + Deck Builder slides
- [x] Quick navigation tiles: Marketplace, Auctions, Metagame, Tournaments, Bazaar, Articles

## Daily Auto-News — AGENT Cron
- [x] Add /api/scheduled/tcg-news POST endpoint with cron auth
- [x] Add auto-publish articles DB helper (upsert by slug to avoid duplicates)
- [x] Mount endpoint in server/_core/index.ts
- [x] Save checkpoint and deploy
- [x] Create daily AGENT cron with TCG research + publish prompt (task_uid: gxsn0wvlBbectgzijsY2bY, fires 9:00 AM ET daily)
- [x] Endpoint tested: returns 403 without cron auth (correct), 200 with valid cron session

## Infinite Scroll (replace pagination)
- [x] Create useInfiniteScroll hook with IntersectionObserver sentinel
- [x] Cards page: replace numbered pagination with infinite scroll
- [x] Pokédex page: replace numbered pagination with infinite scroll
- [x] Articles page: connected to real DB via trpc.articles.list with infinite scroll (20 per batch)
- [x] Auctions page: no pagination needed (loads all auctions)

## CardMarket API Integration (RapidAPI)
- [x] Store RAPIDAPI_KEY as secret
- [x] Build server/cardmarketApi.ts helper (searchByTcgId, getPrices, getHistoryPrices)
- [x] Add cards.getExternalPrices tRPC procedure with in-memory caching (1h TTL)
- [x] Update CardDetail Where to Buy tab: real CardMarket EU + TCGPlayer USD prices per store row (Live badge)
- [x] Update CardDetail Prices tab: real market_price, 30d/7d averages, PSA graded prices from CardMarket API
- [x] Update CardDetail Price History tab: real 90-day historical prices from CardMarket API
- [x] Update sidebar price card: CardMarket NM Low + 30d Avg + TCGPlayer market + PSA grades

## Performance Optimization
- [x] Profile slow endpoints: pokemon.getDetail 6s cold (5-6 sequential PokeAPI calls), sets.recent 4s cold (8 parallel searches)
- [x] pokemontcg.ts already had 10min search / 24h card cache — confirmed working
- [x] Added 24h in-memory cache for pokemon.getDetail via server/lib/cache.ts
- [x] Added 1h in-memory cache for sets.recent (8 parallel searches per call)
- [x] sets.recent and articles.list are now cached — no batching needed
- [x] Added React.lazy() + Suspense for ALL pages except Home — reduces initial bundle significantly
- [x] Added PageLoader skeleton fallback for Suspense boundary in App.tsx
- [x] Added staleTime=2min, gcTime=10min, refetchOnWindowFocus=false to QueryClient defaults

## Marketplace Real (jul/2026)
- [x] Backend: routers products, marketplaceListings, cart, orders (state machine), reviews, notifications, bazaar
- [x] Shop real com produtos do banco, categorias do schema, ordenação e paginação
- [x] ProductDetail (/shop/:slug) com lista de vendedores + "vender este produto"
- [x] Carrinho agrupado por vendedor + checkout (sem gateway; pagamento combinado direto — estilo OLX/Bazar da Liga; arquitetura pronta p/ Stripe)
- [x] Pedidos (/orders): compras e vendas, ações por status, tracking, disputa, avaliação do vendedor
- [x] Navbar: contador real do carrinho + dropdown de notificações (não lidas, marcar como lida)
- [x] Bazaar real: postar cartas (troca/venda), want list, matching automático, top wanted/for trade
- [x] Card Detail: tabela de vendedores reais (listings.getByCardWithSellers) + add-to-cart + seletor de outras edições
- [x] Pokédex completa: 1.025 Pokémon, 9 gerações, filtros por tipo/geração, infinite scroll
- [x] SEO: hook usePageMeta aplicado nas páginas principais + meta description no index.html
- [x] Correções: TRPCError em articles.getBySlug, ComponentShowcase removido, rename PokéCard.tsx → PokeCard.tsx (filename corrompido)
- [ ] Rodar `pnpm check` e `pnpm build` localmente (registry npm bloqueado no sandbox)
- [ ] Futuro: integração Stripe Connect para pagamento no site

## Artigos diários automáticos (jul/2026)
- [x] /api/scheduled/tcg-news: gera capa com IA (imageGeneration) quando o agente não envia coverImageUrl
- [x] Campo "featured" no payload/LLM (só notícias grandes: set novo, ban list, torneio major) — salvo como tag
- [x] Home: banner hero mostra APENAS artigos featured (até 2); demais ficam só na aba Articles
- [x] Articles: hero da página prioriza o artigo featured mais recente; tag interna "featured" oculta dos pills
- [ ] Confirmar no painel Manus que o cron diário do agente está ativo apontando p/ /api/scheduled/tcg-news
