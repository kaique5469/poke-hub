/**
 * Scheduled handler: /api/scheduled/tcg-news
 *
 * Called daily by the AGENT cron. The agent researches the latest Pokémon TCG
 * news and POSTs a structured payload here. This handler validates the cron
 * auth, then uses the built-in LLM to enrich/format the content and persists
 * up to 3 new articles per run (idempotent by slug).
 *
 * It also accepts a direct POST from the AGENT cron with pre-written articles
 * in the body (articles array), which is the primary path used by the agent.
 */

import type { Request, Response } from "express";
import { invokeLLMWithWebSearch } from "./_core/llm";
import { upsertArticleBySlug, getAdminUser, getPublishedArticles } from "./db";
import { ENV } from "./_core/env";
import { areArticleTitlesNearDuplicate } from "./lib/articleQuality";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomingArticle {
  title: string;
  subtitle?: string;
  slug: string;
  content: string;
  category?:
    | "strategy"
    | "deck_guide"
    | "set_review"
    | "tournament"
    | "collector"
    | "news";
  tags?: string[];
  /** true only for MAJOR news (new set release, big ban list, major tournament) → shows in homepage hero banner */
  featured?: boolean;
  /** Ready-made cover image URL (e.g. official set logo/art). Takes priority. */
  coverImageUrl?: string;
  /** National Pokédex number of the most relevant Pokémon → official artwork cover. */
  coverPokemonId?: number;
  /** pokemontcg.io set id (e.g. "sv7") → official set logo cover. */
  coverSetId?: string;
  /** Legacy: description for AI-generated cover art (no longer used). */
  coverImagePrompt?: string;
  /** Sources used to verify facts. Auto-generated articles require at least one. */
  sources?: Array<{ title: string; url: string }>;
}

// ─── Slug sanitizer ───────────────────────────────────────────────────────────
function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

// ─── Date prefix for slug uniqueness ─────────────────────────────────────────
function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10); // "2026-07-06"
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function tcgNewsHandler(req: Request, res: Response) {
  try {
    // 1. Authenticate — must present the cron secret
    if (!ENV.cronSecret || req.headers["x-cron-secret"] !== ENV.cronSecret) {
      return res
        .status(403)
        .json({ error: "cron-only endpoint (x-cron-secret inválido)" });
    }

    // 2. Resolve the admin user as article author
    const adminUser = await getAdminUser();
    if (!adminUser) {
      return res
        .status(500)
        .json({
          error: "Admin user not found — register with the OWNER_EMAIL first.",
        });
    }
    const authorId = adminUser.id;

    // 3. Respond immediately — generation takes minutes and the proxy would
    //    kill the connection. Processing continues in the background.
    const body = req.body as { articles?: IncomingArticle[]; topic?: string };
    res
      .status(202)
      .json({
        ok: true,
        accepted: true,
        message:
          "Generating articles in background — check /articles in ~2 min.",
      });

    processArticles(body, authorId).catch(err =>
      console.error("[tcg-news] Background error:", err)
    );
  } catch (err: any) {
    console.error("[tcg-news] Handler error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: String(err?.message ?? err) });
    }
  }
}

async function processArticles(
  body: { articles?: IncomingArticle[]; topic?: string },
  authorId: number
) {
  {
    // Accept pre-written articles from the agent body, or generate via LLM
    let articlesToPublish: IncomingArticle[] = [];

    if (Array.isArray(body?.articles) && body.articles.length > 0) {
      // Agent sent pre-written articles — use them directly
      articlesToPublish = body.articles.slice(0, 5);
    } else {
      // Research and generate today's TCG news digest
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const topic =
        body?.topic ??
        "latest Pokémon TCG news, new set releases, tournament results, and card market trends";

      const jsonShape = `[
  {
    "title": "Article title (max 80 chars)",
    "subtitle": "One-sentence summary (max 160 chars)",
    "slug": "url-friendly-slug-no-spaces",
    "content": "Full article in Markdown (400-800 words). Include ## headings, bullet points, and a conclusion.",
    "category": "news",
    "tags": ["tag1", "tag2"],
    "featured": false,
    "coverPokemonId": 6,
    "coverSetId": "sv7",
    "sources": [{"title": "Official announcement", "url": "https://www.pokemon.com/..."}]
  }
]
"coverPokemonId": National Pokédex number (1-1025) of the single Pokémon most relevant to the article (e.g. 6 for Charizard). ALWAYS include it.
"coverSetId": ONLY if the article is about a specific TCG set, its official set id in pokemontcg.io format (e.g. "sv7", "sv8pt5", "swsh12"). Omit otherwise.
"sources": 2-5 real HTTPS pages you used. Prefer official Pokémon announcements and primary tournament sources. This field is REQUIRED.
Categories allowed: strategy | deck_guide | set_review | tournament | collector | news
Set "featured": true ONLY for major news that deserves the homepage hero banner — a new set release/reveal, a major ban list or rotation announcement, or results of a major tournament (Worlds, Regionals, NAIC). Everything else must be "featured": false.`;

      let raw = "[]";
      try {
        // Primary path: real-time web search → articles based on actual news
        raw = await invokeLLMWithWebSearch(
          `You are a Pokémon TCG journalist writing for TCG Arena, a US marketplace for collectors and competitive players. Today is ${today}.
First, SEARCH THE WEB for real Pokémon TCG news from the LAST 7 DAYS: ${topic}. Prioritize official Pokémon announcements, major tournament results, new set releases/reveals, and notable card price movements.
Then write 2 news articles based ONLY on real facts you found (include real names, dates and numbers).
Return ONLY a valid JSON array — no markdown, no code fences, no citations or annotations, no text before or after the JSON — with this exact shape:
${jsonShape}`
        );
        console.log("[tcg-news] Generated articles via web search.");
      } catch (searchErr) {
        // Never publish an unresearched fallback. A missed day is preferable
        // to invented news appearing on a marketplace homepage.
        console.error(
          "[tcg-news] Web research failed; nothing was published:",
          searchErr
        );
        return;
      }

      // Strip fences and any stray text around the JSON array
      const noFences = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const aStart = noFences.indexOf("[");
      const aEnd = noFences.lastIndexOf("]");
      const cleaned =
        aStart >= 0 && aEnd > aStart
          ? noFences.slice(aStart, aEnd + 1)
          : noFences;
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          articlesToPublish = parsed.slice(0, 3);
        }
      } catch {
        console.error(
          "[tcg-news] Failed to parse LLM JSON:",
          cleaned.slice(0, 200)
        );
        return;
      }
    }

    // 4. Persist each article (idempotent by slug)
    const results: { slug: string; inserted: boolean }[] = [];
    const prefix = todayPrefix();
    const recentTitles = (await getPublishedArticles(30)).map(
      article => article.title
    );

    for (const art of articlesToPublish) {
      if (!art.title || !art.content) continue;

      const sources = (art.sources ?? [])
        .filter(
          source => source?.title && /^https:\/\//i.test(source.url ?? "")
        )
        .slice(0, 5);
      if (sources.length === 0) {
        console.warn(
          `[tcg-news] Skipping ${art.title}: no verifiable sources.`
        );
        continue;
      }
      if (
        recentTitles.some(title =>
          areArticleTitlesNearDuplicate(title, art.title)
        )
      ) {
        console.warn(
          `[tcg-news] Skipping ${art.title}: recent article covers the same topic.`
        );
        continue;
      }

      const baseSlug = sanitizeSlug(art.slug || art.title);
      const slug = `${prefix}-${baseSlug}`;
      const now = new Date();

      // Cover art: real official images only — explicit URL > set logo > Pokémon artwork
      let coverImageUrl: string | null = art.coverImageUrl ?? null;
      if (
        !coverImageUrl &&
        art.coverSetId &&
        /^[a-z0-9pt.]{2,12}$/i.test(art.coverSetId)
      ) {
        coverImageUrl = `https://images.pokemontcg.io/${art.coverSetId.toLowerCase()}/logo.png`;
      }
      if (!coverImageUrl) {
        const dexId = Number(art.coverPokemonId);
        const safeId =
          Number.isInteger(dexId) && dexId >= 1 && dexId <= 1025 ? dexId : 25;
        coverImageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${safeId}.png`;
      }

      // "featured" travels as a tag — featured articles power the homepage hero banner
      const tags = Array.from(
        new Set([...(art.featured ? ["featured"] : []), ...(art.tags ?? [])])
      );

      const sourceSection =
        sources.length > 0
          ? `\n\n## Sources\n${sources.map(source => `- [${source.title}](${source.url})`).join("\n")}`
          : "";

      const { inserted } = await upsertArticleBySlug({
        authorId,
        title: art.title.slice(0, 512),
        subtitle: art.subtitle?.slice(0, 500) ?? null,
        slug,
        content: `${art.content.trim()}${sourceSection}`,
        category: art.category ?? "news",
        tags,
        isPublished: true,
        publishedAt: now,
        coverImageUrl,
        viewCount: 0,
      });

      results.push({ slug, inserted });
      recentTitles.unshift(art.title);
    }

    const inserted = results.filter(r => r.inserted).length;
    const skipped = results.filter(r => !r.inserted).length;

    console.log(
      `[tcg-news] Published ${inserted} new articles, skipped ${skipped} duplicates.`
    );
  }
}
