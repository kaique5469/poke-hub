# PokéHub — Plataforma Pokémon TCG

Plataforma completa de Pokémon TCG: cartas com preços reais, marketplace estilo OLX, bazar de trocas, Pokédex completa, decks, leilões e artigos diários.

Stack: React 19 + Vite + Tailwind 4 + tRPC 11 + Express + Drizzle ORM (MySQL).

## Rodando localmente

```bash
pnpm install
cp .env.example .env       # edite os valores
pnpm db:push               # cria as tabelas no MySQL
pnpm dev                   # http://localhost:3000
```

Requisitos: Node 20+, pnpm, um MySQL acessível (local ou o do Railway).

## Deploy no Railway (via GitHub)

1. **Suba o código no GitHub**
   ```bash
   git init && git add -A && git commit -m "PokéHub inicial"
   git remote add origin https://github.com/SEU_USUARIO/pokehub.git
   git push -u origin main
   ```

2. **Crie o projeto no Railway** ([railway.app](https://railway.app))
   - New Project → Deploy from GitHub repo → selecione `pokehub`
   - Add Service → Database → **MySQL**

3. **Variáveis de ambiente** (no serviço do app → Variables)
   - `DATABASE_URL` → use a referência `${{ MySQL.MYSQL_URL }}`
   - `JWT_SECRET` → string longa aleatória (`openssl rand -hex 32`)
   - `APP_URL` → a URL pública gerada pelo Railway (Settings → Networking → Generate Domain)
   - `OWNER_EMAIL` → seu email (quem se registrar com ele vira admin)
   - `CRON_SECRET` → outra string aleatória
   - `SCRYDEX_API_KEY` → Primary API Key da Scrydex (somente no serviço do app)
   - `SCRYDEX_TEAM_ID` → Team ID da Scrydex
   - Opcionais: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `RAPIDAPI_KEY`
   - `DATA_DIR` → `/data`

4. **Volume para uploads** (capas de artigos, etc.)
   - No serviço do app → Settings → Volumes → Mount path `/data`

5. **Comandos de build/start** (Railway detecta sozinho pelo package.json)
   - Build: `pnpm install && pnpm build`
   - Start: `pnpm start`
   - Rode as migrações uma vez: no Railway → serviço do app → aba Deployments → shell, ou localmente com `DATABASE_URL` do Railway: `pnpm db:push`

6. **Primeiro acesso**
   - Abra o site → `/login` → registre-se com o `OWNER_EMAIL` → você é admin.

Cada `git push` na branch main faz deploy automático.

## Login com Google (opcional)

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) → Create Credentials → OAuth client ID → Web application
2. Authorized redirect URI: `https://SEU-APP.up.railway.app/api/auth/google/callback`
3. Copie Client ID e Client Secret para as variáveis do Railway.

## Artigos diários com IA (opcional)

O endpoint `POST /api/scheduled/tcg-news` (protegido pelo header `x-cron-secret`) publica até 5 artigos por dia:

- **Com `OPENAI_API_KEY`**: gera 2 artigos + capas automaticamente.
- **Sem a chave**: aceita artigos pré-escritos no body (`{"articles": [...]}`).

O workflow `.github/workflows/daily-articles.yml` chama o endpoint todo dia às 9h (Brasília). Configure os secrets `APP_URL` e `CRON_SECRET` no GitHub (Settings → Secrets → Actions). Artigos com `"featured": true` aparecem no banner da homepage.

## Catálogo real de produtos selados

O catálogo de booster boxes, ETBs, bundles, tins, packs e coleções vem da
Scrydex. O backend importa imagens reais, expansão, idioma e preços de mercado
em USD para o MySQL; as chaves nunca são enviadas ao navegador.

- A primeira visita ao marketplace sincroniza o catálogo se ele estiver desatualizado.
- `POST /api/scheduled/scrydex-sync` atualiza o catálogo e é protegido por `x-cron-secret`.
- O workflow `.github/workflows/daily-catalog.yml` executa a atualização diariamente.
- Produtos antigos gerados automaticamente são ocultados após a primeira sincronização real; produtos com anúncios de vendedores são preservados.

## Market Pulse para colecionadores

A rota `/market` reúne sinais reais e separa claramente a origem de cada dado:

- snapshots de preços raw/NM em USD da Scrydex, com fallback nomeado do TCGPlayer via Pokémon TCG API;
- variações e índice calculados apenas entre observações da mesma fonte, variante, condição e moeda;
- buscas, visualizações e watchlists identificadas como atividade interna do TCG Arena;
- ranking e feed de vendas baseados somente em pedidos de cartas com pagamento confirmado;
- valor estimado da coleção, watchlist e alerta único de preço-alvo para usuários autenticados.

`POST /api/scheduled/market-snapshot` captura as observações e processa alertas. O endpoint usa o mesmo header `x-cron-secret` dos demais jobs, e o workflow `.github/workflows/daily-market.yml` executa a coleta diariamente. As tabelas também são criadas de forma idempotente no startup para manter o deploy do Railway compatível com instalações que ainda não executam migrações automaticamente.

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Desenvolvimento com hot reload |
| `pnpm build` | Build de produção (client + server) |
| `pnpm start` | Roda o build de produção |
| `pnpm check` | Typecheck |
| `pnpm test` | Testes (vitest) |
| `pnpm db:push` | Gera e aplica migrações Drizzle |
