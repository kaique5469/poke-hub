/**
 * Minimal Stripe integration via raw REST API (no SDK dependency).
 * Requires STRIPE_SECRET_KEY; webhook verification requires STRIPE_WEBHOOK_SECRET.
 */
import crypto from "crypto";

const API = "https://api.stripe.com/v1";
const key = () => process.env.STRIPE_SECRET_KEY ?? "";

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** form-encode nested params the way Stripe expects (a[b][c]=v) */
function encode(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export interface StripeSession {
  id: string;
  url: string;
}

export async function createCheckoutSession(opts: {
  amountUsd: number;
  description: string;
  orderIds: number[];
  buyerEmail?: string | null;
  origin: string;
}): Promise<StripeSession> {
  if (!stripeEnabled()) throw new Error("Stripe is not configured");
  const params: Record<string, string | number> = {
    mode: "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": Math.round(opts.amountUsd * 100),
    "line_items[0][price_data][product_data][name]": opts.description,
    success_url: `${opts.origin}/orders?payment=success`,
    cancel_url: `${opts.origin}/cart?payment=cancelled`,
    "metadata[orderIds]": opts.orderIds.join(","),
  };
  if (opts.buyerEmail) params["customer_email"] = opts.buyerEmail;

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encode(params),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.id || !data.url) {
    throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  }
  return { id: data.id, url: data.url };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id: string; metadata?: Record<string, string> } };
}

/**
 * Verify a Stripe webhook signature (v1 scheme) and return the parsed event.
 * Returns null when the signature is invalid or the timestamp is too old.
 */
export function verifyWebhook(payload: Buffer, sigHeader: string | undefined): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return null;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return null;

  // Reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${payload.toString("utf8")}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(payload.toString("utf8")) as StripeEvent;
  } catch {
    return null;
  }
}

// ─── Stripe Connect (Express) ────────────────────────────────────────────────

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const data = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

async function stripePost(
  path: string,
  params: Record<string, string | number>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: encode(params),
  });
  const data = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

/** Create an Express connected account for a seller. Returns the account id. */
export async function createConnectAccount(email?: string | null): Promise<string> {
  const params: Record<string, string | number> = {
    type: "express",
    "capabilities[transfers][requested]": "true",
  };
  if (email) params["email"] = email;
  const data = await stripePost("/accounts", params);
  return data.id as string;
}

/** One-time onboarding link for an Express account. */
export async function createAccountLink(accountId: string, origin: string): Promise<string> {
  const data = await stripePost("/account_links", {
    account: accountId,
    refresh_url: `${origin}/dashboard?connect=refresh`,
    return_url: `${origin}/dashboard?connect=done`,
    type: "account_onboarding",
  });
  return data.url as string;
}

export interface ConnectStatus {
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export async function getAccountStatus(accountId: string): Promise<ConnectStatus> {
  const data = await stripeGet(`/accounts/${accountId}`);
  return {
    payoutsEnabled: !!data.payouts_enabled,
    detailsSubmitted: !!data.details_submitted,
  };
}

/** Charge id behind a completed Checkout Session (needed for transfers). */
export async function getSessionCharge(sessionId: string): Promise<string | null> {
  const data = await stripeGet(`/checkout/sessions/${sessionId}?expand[]=payment_intent`);
  const pi = data.payment_intent as { latest_charge?: string } | null;
  return pi?.latest_charge ?? null;
}

/** Transfer funds from the platform balance to a connected account. */
export async function createTransfer(opts: {
  amountCents: number;
  destination: string;
  sourceCharge: string;
  description: string;
  idempotencyKey?: string;
}): Promise<string> {
  const data = await stripePost("/transfers", {
    amount: opts.amountCents,
    currency: "usd",
    destination: opts.destination,
    source_transaction: opts.sourceCharge,
    description: opts.description,
  }, opts.idempotencyKey);
  return data.id as string;
}

/** Refund a charge in full (cancellation/dispute before escrow release). */
export async function createRefund(chargeId: string, idempotencyKey?: string): Promise<string> {
  const data = await stripePost("/refunds", { charge: chargeId }, idempotencyKey);
  return data.id as string;
}
