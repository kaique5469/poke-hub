import {
  createCipheriv,
  createECDH,
  createHash,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
  type JsonWebKey as CryptoJsonWebKey,
} from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { dropPushSubscriptions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function allowedPushEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    return (
      raw.length <= 2_048 &&
      url.protocol === "https:" &&
      (PUSH_HOSTS.has(url.hostname) || url.hostname.endsWith(".push.apple.com"))
    );
  } catch {
    return false;
  }
}

function hmac(key: Buffer, value: Buffer) {
  return createHmac("sha256", key).update(value).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  let output = Buffer.alloc(0);
  let previous = Buffer.alloc(0);
  let counter = 1;
  while (output.length < length) {
    previous = hmac(
      prk,
      Buffer.concat([previous, info, Buffer.from([counter])])
    );
    output = Buffer.concat([output, previous]);
    counter += 1;
  }
  return output.subarray(0, length);
}

function vapidKeys() {
  try {
    const publicKey = Buffer.from(ENV.dropVapidPublicKey, "base64url");
    const privateKey = Buffer.from(ENV.dropVapidPrivateKey, "base64url");
    if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
      return null;
    }
    return { publicKey, privateKey };
  } catch {
    return null;
  }
}

export function webPushConfigured() {
  return vapidKeys() !== null;
}

function vapidAuthorization(endpoint: string) {
  const keys = vapidKeys();
  if (!keys) throw new Error("VAPID keys are not configured");
  const audience = new URL(endpoint).origin;
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString(
    "base64url"
  );
  const payload = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1_000) + 12 * 60 * 60,
      sub: ENV.dropVapidSubject,
    })
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const jwk: CryptoJsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: keys.publicKey.subarray(1, 33).toString("base64url"),
    y: keys.publicKey.subarray(33, 65).toString("base64url"),
    d: keys.privateKey.toString("base64url"),
  };
  const privateKey = createPrivateKey({ key: jwk, format: "jwk" });
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `vapid t=${unsigned}.${signature}, k=${ENV.dropVapidPublicKey}`;
}

export function encryptWebPushPayload(input: {
  payload: Buffer;
  clientPublicKey: string;
  authSecret: string;
}) {
  const userPublic = Buffer.from(input.clientPublicKey, "base64url");
  const auth = Buffer.from(input.authSecret, "base64url");
  if (userPublic.length !== 65 || userPublic[0] !== 4 || auth.length < 16) {
    throw new Error("Invalid Web Push subscription keys");
  }

  const server = createECDH("prime256v1");
  server.generateKeys();
  const serverPublic = server.getPublicKey();
  const sharedSecret = server.computeSecret(userPublic);
  const authPrk = hmac(auth, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublic,
    serverPublic,
  ]);
  const ikm = hkdfExpand(authPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const contentKey = hkdfExpand(
    prk,
    Buffer.from("Content-Encoding: aes128gcm\0", "utf8"),
    16
  );
  const nonce = hkdfExpand(
    prk,
    Buffer.from("Content-Encoding: nonce\0", "utf8"),
    12
  );
  const plaintext = Buffer.concat([input.payload, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4_096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublic.length]),
    serverPublic,
    ciphertext,
  ]);
}

export async function upsertDropPushSubscription(input: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  if (!allowedPushEndpoint(input.endpoint)) {
    throw new Error("Unsupported push service endpoint");
  }
  const endpointHash = createHash("sha256").update(input.endpoint).digest("hex");
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(dropPushSubscriptions)
    .values({ ...input, endpointHash, userAgent: input.userAgent ?? null })
    .onDuplicateKeyUpdate({
      set: {
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        failureCount: 0,
      },
    });
}

export async function removeDropPushSubscription(
  userId: number,
  endpoint: string
) {
  const db = await getDb();
  if (!db) return;
  const endpointHash = createHash("sha256").update(endpoint).digest("hex");
  await db
    .delete(dropPushSubscriptions)
    .where(
      sql`${dropPushSubscriptions.userId} = ${userId} AND ${dropPushSubscriptions.endpointHash} = ${endpointHash}`
    );
}

async function sendSubscription(
  subscription: typeof dropPushSubscriptions.$inferSelect,
  payload: Buffer
) {
  const body = encryptWebPushPayload({
    payload,
    clientPublicKey: subscription.p256dh,
    authSecret: subscription.auth,
  });
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "120",
      Urgency: "high",
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(8_000),
  });
  return response.status;
}

export async function sendDropWebPushToUser(
  userId: number,
  payload: Record<string, unknown>
) {
  if (!webPushConfigured()) return { sent: 0, failed: 0 };
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };
  const subscriptions = await db
    .select()
    .from(dropPushSubscriptions)
    .where(eq(dropPushSubscriptions.userId, userId));
  const encoded = Buffer.from(JSON.stringify(payload), "utf8");
  if (encoded.length > 3_000) throw new Error("Push payload is too large");
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try {
      const status = await sendSubscription(subscription, encoded);
      if (status >= 200 && status < 300) {
        sent += 1;
        await db
          .update(dropPushSubscriptions)
          .set({ lastSuccessAt: new Date(), failureCount: 0 })
          .where(eq(dropPushSubscriptions.id, subscription.id));
      } else if (status === 404 || status === 410) {
        await db
          .delete(dropPushSubscriptions)
          .where(eq(dropPushSubscriptions.id, subscription.id));
      } else {
        failed += 1;
        await db
          .update(dropPushSubscriptions)
          .set({ failureCount: sql`${dropPushSubscriptions.failureCount} + 1` })
          .where(eq(dropPushSubscriptions.id, subscription.id));
      }
    } catch (error) {
      failed += 1;
      console.error(
        "[drop-monitor] Web Push delivery failed",
        error instanceof Error ? error.name : "unknown error"
      );
    }
  }
  return { sent, failed };
}
