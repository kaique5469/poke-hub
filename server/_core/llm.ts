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
