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
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { upsertArticleBySlug, getAdminUser } from "./db";
import { ENV } from "./_core/env";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomingArticle {
  title: string;
  subtitle?: string;
  slug: string;
  content: string;
  category?: "strategy" | "deck_guide" | "set_review" | "tournament" | "collector" | "news";
  tags?: string[];
  /** true only for MAJOR news (new set release, big ban list, major tournament) → shows in homepage hero banner */
  featured?: boolean;
  /** Ready-made cover image URL (e.g. official set logo/art). Takes priority over generation. */
  coverImageUrl?: string;
  /** Description for AI-generated cover art when no coverImageUrl is given. */
  coverImagePrompt?: string;
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
      return res.status(403).json({ error: "cron-only endpoint (x-cron-secret inválido)" });
    }

    // 2. Resolve the admin user as article author
    const adminUser = await getAdminUser();
    if (!adminUser) {
      return res.status(500).json({ error: "Admin user not found — register with the OWNER_EMAIL first." });
    }
    const authorId = adminUser.id;

    // 3. Respond immediately — generation takes minutes and the proxy would
    //    kill the connection. Processing continues in the background.
    const body = req.body as { articles?: IncomingArticle[]; topic?: string };
    res.status(202).json({ ok: true, accepted: true, message: "Generating articles in background — check /articles in ~2 min." });

    processArticles(body, authorId).catch(err => console.error("[tcg-news] Background error:", err));
  } catch (err: any) {
    console.error("[tcg-news] Handler error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: String(err?.message ?? err) });
    }
  }
}

async function processArticles(body: { articles?: IncomingArticle[]; topic?: string }, authorId: number) {
  {
    // Accept pre-written articles from the agent body, or generate via LLM
    let articlesToPublish: IncomingArticle[] = [];

    if (Array.isArray(body?.articles) && body.articles.length > 0) {
      // Agent sent pre-written articles — use them directly
      articlesToPublish = body.articles.slice(0, 5);
    } else {
      // Fallback: ask the LLM to generate today's TCG news digest
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const topic = body?.topic ?? "latest Pokémon TCG news, new set releases, tournament results, and card market trends";

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a Pokémon TCG journalist writing for PokéHub USA, the #1 TCG platform for US collectors and competitive players. 
Today is ${today}.
Write 2 news articles about: ${topic}.
Return ONLY a valid JSON array (no markdown, no code fences) with this exact shape:
[
  {
    "title": "Article title (max 80 chars)",
    "subtitle": "One-sentence summary (max 160 chars)",
    "slug": "url-friendly-slug-no-spaces",
    "content": "Full article in Markdown (400-800 words). Include ## headings, bullet points, and a conclusion.",
    "category": "news",
    "tags": ["tag1", "tag2"],
    "featured": false,
    "coverImagePrompt": "Short visual description for the article cover art (no text in image)"
  }
]
Categories allowed: strategy | deck_guide | set_review | tournament | collector | news
Set "featured": true ONLY for major news that deserves the homepage hero banner — a new set release/reveal, a major ban list or rotation announcement, or results of a major tournament (Worlds, Regionals, NAIC). Everything else must be "featured": false.
Keep content factual and relevant to the US TCG market.`,
          },
          {
            role: "user",
            content: `Write 2 Pokémon TCG news articles for today (${today}). Focus on: ${topic}`,
          },
        ],
      });

      const rawContent = llmResponse?.choices?.[0]?.message?.content ?? "[]";
      const raw = typeof rawContent === "string" ? rawContent : "[]";
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          articlesToPublish = parsed.slice(0, 3);
        }
      } catch {
        console.error("[tcg-news] Failed to parse LLM JSON:", cleaned.slice(0, 200));
        return;
      }
    }

    // 4. Persist each article (idempotent by slug)
    const results: { slug: string; inserted: boolean }[] = [];
    const prefix = todayPrefix();

    for (const art of articlesToPublish) {
      if (!art.title || !art.content) continue;

      const baseSlug = sanitizeSlug(art.slug || art.title);
      const slug = `${prefix}-${baseSlug}`;
      const now = new Date();

      // Cover art: explicit URL from agent > AI-generated > null (best-effort)
      let coverImageUrl: string | null = art.coverImageUrl ?? null;
      if (!coverImageUrl) {
        try {
          const prompt = art.coverImagePrompt
            ? `${art.coverImagePrompt}. Vibrant editorial illustration for a Pokémon TCG news site, wide 16:9 composition, dynamic lighting, NO text or words in the image.`
            : `Editorial cover illustration for a Pokémon TCG article titled "${art.title}". Vibrant trading-card-game atmosphere, holographic sparkle accents, wide 16:9 composition, NO text or words in the image.`;
          const { url } = await generateImage({ prompt });
          coverImageUrl = url ?? null;
        } catch (imgErr) {
          console.warn(`[tcg-news] Cover generation failed for "${art.title}":`, imgErr);
        }
      }

      // "featured" travels as a tag — featured articles power the homepage hero banner
      const tags = Array.from(new Set([...(art.featured ? ["featured"] : []), ...(art.tags ?? [])]));

      const { inserted } = await upsertArticleBySlug({
        authorId,
        title: art.title.slice(0, 512),
        subtitle: art.subtitle?.slice(0, 500) ?? null,
        slug,
        content: art.content,
        category: art.category ?? "news",
        tags,
        isPublished: true,
        publishedAt: now,
        coverImageUrl,
        viewCount: 0,
      });

      results.push({ slug, inserted });
    }

    const inserted = results.filter(r => r.inserted).length;
    const skipped = results.filter(r => !r.inserted).length;

    console.log(`[tcg-news] Published ${inserted} new articles, skipped ${skipped} duplicates.`);
  }
}
