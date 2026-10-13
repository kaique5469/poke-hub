/**
 * RarityGrid Pro — Stripe subscriptions via the raw REST API (same style as
 * lib/stripe.ts, no SDK). One Stripe Price per currency × interval, read
 * from the environment so prices can change without a deploy:
 *
 *   STRIPE_PRO_PRICE_MONTH_USD  STRIPE_PRO_PRICE_YEAR_USD
 *   STRIPE_PRO_PRICE_MONTH_BRL  STRIPE_PRO_PRICE_YEAR_BRL
 *
 * BRL falls back to USD prices when its own are not configured. With no
 * prices at all, `billing.status` reports `available: false` and the app
 * shows the paywall without a buy button.
 */
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  PRO_INTERVALS,
  type AppCurrency,
  type ProInterval,
} from "@shared/app";

const API = "https://api.stripe.com/v1";
const key = () => process.env.STRIPE_SECRET_KEY ?? "";

export function proPriceId(interval: ProInterval, currency: AppCurrency) {
  const exact = process.env[`STRIPE_PRO_PRICE_${interval.toUpperCase()}_${currency}`];
  if (exact) return { priceId: exact, currency };
  const usd = process.env[`STRIPE_PRO_PRICE_${interval.toUpperCase()}_USD`];
  if (usd) return { priceId: usd, currency: "USD" as AppCurrency };
  return null;
}

export function proBillingAvailable() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      PRO_INTERVALS.some(i => proPriceId(i, "USD"))
  );
}

function encode(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number>,
  idempotencyKey?: string,
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key()}` };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers,
    body: method === "POST" && params ? encode(params) : undefined,
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

/** Creates (once) and remembers the Stripe customer for a user. */
export async function ensureStripeCustomer(user: {
  id: number;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
}) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe(
    "POST",
    "/customers",
    {
      ...(user.email ? { email: user.email } : {}),
      ...(user.name ? { name: user.name } : {}),
      "metadata[userId]": user.id,
    },
    `customer_user_${user.id}`
  );
  const id = String(customer.id);
  const db = await getDb();
  if (db) {
    await db.update(users).set({ stripeCustomerId: id }).where(eq(users.id, user.id));
  }
  return id;
}

export async function createProCheckout(opts: {
  user: { id: number; email: string | null; name: string | null; stripeCustomerId: string | null };
  interval: ProInterval;
  currency: AppCurrency;
  origin: string;
  locale: "pt-BR" | "en";
}) {
  const price = proPriceId(opts.interval, opts.currency);
  if (!price) throw new Error("Pro prices are not configured");
  const customerId = await ensureStripeCustomer(opts.user);
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": price.priceId,
    "line_items[0][quantity]": 1,
    client_reference_id: `user_${opts.user.id}`,
    "metadata[userId]": opts.user.id,
    "metadata[kind]": "pro",
    "subscription_data[metadata][userId]": opts.user.id,
    allow_promotion_codes: "true",
    locale: opts.locale === "pt-BR" ? "pt-BR" : "en",
    success_url: `${opts.origin}/app/settings?pro=success`,
    cancel_url: `${opts.origin}/app/settings?pro=cancelled`,
  });
  return { url: String(session.url), currency: price.currency };
}

export async function createBillingPortal(customerId: string, returnUrl: string) {
  const session = await stripe("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: String(session.url) };
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
};

export async function getSubscription(id: string, fetchImpl?: typeof fetch) {
  return (await stripe("GET", `/subscriptions/${id}`, undefined, undefined, fetchImpl)) as unknown as StripeSubscription;
}

/** "active" and "trialing" keep Pro on; "past_due" keeps it on during the grace window. */
export function planFromSubscription(sub: Pick<StripeSubscription, "status" | "current_period_end">) {
  const proStatuses = new Set(["active", "trialing", "past_due"]);
  const proUntil = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  return {
    plan: proStatuses.has(sub.status) ? ("pro" as const) : ("free" as const),
    proUntil,
  };
}

/**
 * Applies a subscription state to the user it belongs to. Resolves the user
 * by metadata.userId first, then by the Stripe customer id.
 */
export async function applySubscription(sub: StripeSubscription) {
  const db = await getDb();
  if (!db) return { updated: false as const, reason: "no_db" as const };
  const metaUser = Number(sub.metadata?.userId);
  const { plan, proUntil } = planFromSubscription(sub);
  const patch = {
    plan,
    proUntil,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: plan === "pro" ? sub.id : null,
  };
  if (Number.isFinite(metaUser) && metaUser > 0) {
    await db.update(users).set(patch).where(eq(users.id, metaUser));
    return { updated: true as const, userId: metaUser, plan, proUntil };
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, sub.customer))
    .limit(1);
  if (!row) return { updated: false as const, reason: "no_user" as const };
  await db.update(users).set(patch).where(eq(users.id, row.id));
  return { updated: true as const, userId: row.id, plan, proUntil };
}

/**
 * Webhook entry point for subscription events. Returns true when the event
 * was a subscription event (handled here), false when it belongs to the
 * marketplace flow.
 */
export async function handleSubscriptionEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<boolean> {
  const obj = event.data.object;
  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    const subId = typeof obj.subscription === "string" ? obj.subscription : null;
    if (subId) await applySubscription(await getSubscription(subId));
    return true;
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await applySubscription(obj as unknown as StripeSubscription);
    return true;
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subId = typeof obj.subscription === "string" ? obj.subscription : null;
    if (subId) await applySubscription(await getSubscription(subId));
    return true;
  }
  return false;
}
