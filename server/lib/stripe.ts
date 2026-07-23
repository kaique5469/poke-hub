/**
 * Minimal Stripe integration via raw REST API (no SDK dependency).
 * Requires STRIPE_SECRET_KEY; webhook verification requires STRIPE_WEBHOOK_SECRET.
 */
import crypto from "crypto";
import {
  CHECKOUT_RESERVATION_MINUTES,
  MARKETPLACE_COUNTRY,
  MARKETPLACE_CURRENCY,
  type ShippingAddress,
} from "@shared/marketplace";

const API = "https://api.stripe.com/v1";
const key = () => process.env.STRIPE_SECRET_KEY ?? "";

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

/** form-encode nested params the way Stripe expects (a[b][c]=v) */
function encode(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");
}

export interface StripeSession {
  id: string;
  url: string;
  expiresAt: Date;
}

export async function createCheckoutSession(opts: {
  amountBrl: number;
  description: string;
  orderIds: number[];
  buyerEmail?: string | null;
  origin: string;
}): Promise<StripeSession> {
  if (!stripeEnabled()) throw new Error("Stripe is not configured");
  const expiresAt = new Date(
    Date.now() + CHECKOUT_RESERVATION_MINUTES * 60_000
  );
  const checkoutReference = `rg_${opts.orderIds.join("_")}`;
  const params: Record<string, string | number> = {
    mode: "payment",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "pix",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": MARKETPLACE_CURRENCY.toLowerCase(),
    "line_items[0][price_data][unit_amount]": Math.round(opts.amountBrl * 100),
    "line_items[0][price_data][product_data][name]": opts.description,
    success_url: `${opts.origin}/orders?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/cart?payment=cancelled`,
    client_reference_id: checkoutReference,
    expires_at: Math.ceil(expiresAt.getTime() / 1000),
    "shipping_address_collection[allowed_countries][0]": MARKETPLACE_COUNTRY,
    "phone_number_collection[enabled]": "true",
    billing_address_collection: "auto",
    "payment_intent_data[transfer_group]": checkoutReference,
    "custom_text[shipping_address][message]":
      "O frete rastreado dentro do Brasil deve estar incluído no preço do anúncio.",
    "metadata[orderIds]": opts.orderIds.join(","),
  };
  if (opts.buyerEmail) params["customer_email"] = opts.buyerEmail;

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout_${opts.orderIds.join("_")}`,
    },
    body: encode(params),
  });
  const data = (await res.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.id || !data.url) {
    throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  }
  return { id: data.id, url: data.url, expiresAt };
}

/** Prevent payment against an order whose local reservation could not persist. */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  await stripePost(`/checkout/sessions/${sessionId}/expire`, {});
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: "paid" | "unpaid" | "no_payment_required";
      metadata?: Record<string, string>;
    };
  };
}

export interface StripePaymentDetails {
  chargeId: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: ShippingAddress | null;
}

/**
 * Verify a Stripe webhook signature (v1 scheme) and return the parsed event.
 * Returns null when the signature is invalid or the timestamp is too old.
 */
export function verifyWebhook(
  payload: Buffer,
  sigHeader: string | undefined
): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return null;

  const parts = Object.fromEntries(
    sigHeader.split(",").map(p => p.split("=") as [string, string])
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
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok)
    throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

async function stripePost(
  path: string,
  params: Record<string, string | number>,
  idempotencyKey?: string
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
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok)
    throw new Error(data.error?.message ?? `Stripe error (${res.status})`);
  return data;
}

export interface CheckoutSessionStatus {
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
}

/**
 * Used by the reservation safety job before restoring inventory. A local
 * timeout alone is not proof that Stripe did not receive the payment.
 */
export async function getCheckoutSessionStatus(
  sessionId: string
): Promise<CheckoutSessionStatus> {
  const data = await stripeGet(`/checkout/sessions/${sessionId}`);
  const status = data.status;
  const paymentStatus = data.payment_status;
  if (!["open", "complete", "expired"].includes(String(status))) {
    throw new Error("Stripe returned an unknown Checkout Session status");
  }
  if (
    !["paid", "unpaid", "no_payment_required"].includes(String(paymentStatus))
  ) {
    throw new Error("Stripe returned an unknown payment status");
  }
  return {
    status: status as CheckoutSessionStatus["status"],
    paymentStatus: paymentStatus as CheckoutSessionStatus["paymentStatus"],
  };
}

/** Create an Express connected account for a seller. Returns the account id. */
export async function createConnectAccount(
  email?: string | null
): Promise<string> {
  const params: Record<string, string | number> = {
    type: "express",
    country: MARKETPLACE_COUNTRY,
    business_type: "individual",
    "capabilities[card_payments][requested]": "true",
    "capabilities[transfers][requested]": "true",
  };
  if (email) params["email"] = email;
  const data = await stripePost("/accounts", params);
  return data.id as string;
}

/** One-time onboarding link for an Express account. */
export async function createAccountLink(
  accountId: string,
  origin: string
): Promise<string> {
  const data = await stripePost("/account_links", {
    account: accountId,
    refresh_url: `${origin}/dashboard?connect=refresh`,
    return_url: `${origin}/dashboard?connect=done`,
    type: "account_onboarding",
  });
  return data.url as string;
}

export interface ConnectStatus {
  country: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export async function getAccountStatus(
  accountId: string
): Promise<ConnectStatus> {
  const data = await stripeGet(`/accounts/${accountId}`);
  return {
    country: typeof data.country === "string" ? data.country : null,
    chargesEnabled: !!data.charges_enabled,
    payoutsEnabled: !!data.payouts_enabled,
    detailsSubmitted: !!data.details_submitted,
  };
}

/** Charge + fulfillment details behind a completed Checkout Session. */
export async function getSessionPaymentDetails(
  sessionId: string
): Promise<StripePaymentDetails> {
  const data = await stripeGet(
    `/checkout/sessions/${sessionId}?expand[]=payment_intent`
  );
  const pi = data.payment_intent as { latest_charge?: string } | null;
  const collected = data.collected_information as {
    shipping_details?: StripeShippingDetails | null;
  } | null;
  // `shipping_details` is retained as a compatibility fallback for older
  // Stripe API versions while current versions use collected_information.
  const shipping =
    collected?.shipping_details ??
    (data.shipping_details as StripeShippingDetails | null | undefined) ??
    null;
  const customer = data.customer_details as { phone?: string | null } | null;
  const address = shipping?.address;
  return {
    chargeId: pi?.latest_charge ?? null,
    shippingName: shipping?.name ?? null,
    shippingPhone: shipping?.phone ?? customer?.phone ?? null,
    shippingAddress:
      address?.line1 &&
      address.city &&
      address.state &&
      address.postal_code &&
      address.country
        ? {
            line1: address.line1,
            line2: address.line2 ?? null,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            country: address.country,
          }
        : null,
  };
}

interface StripeShippingDetails {
  name?: string | null;
  phone?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}

/** Transfer funds from the platform balance to a connected account. */
export async function createTransfer(opts: {
  amountCents: number;
  destination: string;
  sourceCharge: string;
  description: string;
  idempotencyKey?: string;
}): Promise<string> {
  const data = await stripePost(
    "/transfers",
    {
      amount: opts.amountCents,
      currency: MARKETPLACE_CURRENCY.toLowerCase(),
      destination: opts.destination,
      source_transaction: opts.sourceCharge,
      description: opts.description,
    },
    opts.idempotencyKey
  );
  return data.id as string;
}

/** Refund one order's amount from a potentially multi-order cart charge. */
export async function createRefund(
  chargeId: string,
  amountCents: number,
  idempotencyKey?: string
): Promise<string> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid refund amount");
  }
  const data = await stripePost(
    "/refunds",
    { charge: chargeId, amount: amountCents },
    idempotencyKey
  );
  return data.id as string;
}
