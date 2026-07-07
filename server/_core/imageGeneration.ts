// Cover-art generation via OpenAI Images API, saved to local storage.
// Optional: callers treat failures as best-effort (article publishes without cover).

import { ENV } from "./env";
import { storagePut } from "../storage";

export async function generateImage(opts: { prompt: string }): Promise<{ url: string | null }> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY não configurada — geração de imagens desativada.");
  }
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: opts.prompt,
      size: "1536x1024",
      n: 1,
    }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Image generation failed (${resp.status}): ${msg}`);
  }
  const data = (await resp.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = data.data?.[0];
  if (item?.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");
    const { url } = await storagePut("covers/cover.png", buf, "image/png");
    return { url };
  }
  if (item?.url) return { url: item.url };
  return { url: null };
}
