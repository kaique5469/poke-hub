// Local-disk storage: writes files under ENV.dataDir/uploads,
// served by express.static at /uploads (see _core/index.ts).
// On Railway, mount a volume at DATA_DIR to persist across deploys.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { ENV } from "./_core/env";

function uploadsDir(): string {
  return path.resolve(ENV.dataDir, "uploads");
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\./g, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = path.join(uploadsDir(), key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await fs.writeFile(filePath, buf);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}
