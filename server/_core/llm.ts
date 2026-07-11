// Minimal LLM client (OpenAI Chat Completions API).
// Optional: only used by the daily-articles fallback. Without OPENAI_API_KEY,
// the /api/scheduled/tcg-news endpoint still works with pre-written articles.

import { ENV } from "./env";

export type Role = "system" | "user" | "assistant";
export interface Message { role: Role; content: string; }
export interface InvokeParams { messages: Message[]; model?: string; temperature?: number; }
export interface InvokeResult { choices: { message: { role: string; content: string } }[]; }

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured — automatic article generation disabled.");
  }
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: params.model ?? "gpt-4o-mini",
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`LLM request failed (${resp.status}): ${msg}`);
  }
  return (await resp.json()) as InvokeResult;
}

/**
 * LLM with real-time web search (OpenAI Responses API + web_search tool).
 * The model searches the web before answering, so content reflects actual
 * current news. Returns the final text output.
 */
export async function invokeLLMWithWebSearch(input: string, model = "gpt-4o-mini"): Promise<string> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured — web-search generation disabled.");
  }
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input,
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Web-search LLM request failed (${resp.status}): ${msg}`);
  }
  const data: any = await resp.json();
  // Prefer the convenience field; otherwise walk the output items
  if (typeof data.output_text === "string" && data.output_text.length > 0) return data.output_text;
  const msgItem = (data.output ?? []).find((o: any) => o.type === "message");
  const text = msgItem?.content?.find((c: any) => c.type === "output_text")?.text;
  if (!text) throw new Error("Web-search LLM returned no text output.");
  return text;
}
