import { afterEach, describe, expect, it, vi } from "vitest";
import { isPro } from "@shared/app";
import {
  getSubscription,
  handleSubscriptionEvent,
  planFromSubscription,
  proBillingAvailable,
  proPriceId,
} from "./lib/subscription";

const DAY = 86_400_000;

describe("isPro entitlement", () => {
  it("is false for free users and anonymous visitors", () => {
    expect(isPro(null)).toBe(false);
    expect(isPro({ plan: "free" })).toBe(false);
  });

  it("is true for an active Pro and for admins", () => {
    const future = new Date(Date.now() + 20 * DAY);
    expect(isPro({ plan: "pro", proUntil: future })).toBe(true);
    expect(isPro({ plan: "pro", proUntil: null })).toBe(true);
    expect(isPro({ plan: "free", role: "admin" })).toBe(true);
  });

  it("keeps Pro for a 3-day grace window after the period ends, then drops it", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const ended2d = new Date(now.getTime() - 2 * DAY);
    const ended5d = new Date(now.getTime() - 5 * DAY);
    expect(isPro({ plan: "pro", proUntil: ended2d }, now)).toBe(true);
    expect(isPro({ plan: "pro", proUntil: ended5d }, now)).toBe(false);
  });
});

describe("plan from Stripe subscription", () => {
  it("maps statuses and the period end", () => {
    const end = 1_800_000_000;
    expect(planFromSubscription({ status: "active", current_period_end: end })).toEqual({
      plan: "pro",
      proUntil: new Date(end * 1000),
    });
    expect(planFromSubscription({ status: "trialing", current_period_end: end }).plan).toBe("pro");
    expect(planFromSubscription({ status: "past_due", current_period_end: end }).plan).toBe("pro");
    expect(planFromSubscription({ status: "canceled", current_period_end: end }).plan).toBe("free");
    expect(planFromSubscription({ status: "unpaid" }).proUntil).toBeNull();
  });
});

describe("price configuration", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("STRIPE_")) delete process.env[k];
    }
    Object.assign(process.env, saved);
  });

  it("falls back to USD prices when BRL ones are missing", () => {
    process.env.STRIPE_PRO_PRICE_MONTH_USD = "price_usd_m";
    delete process.env.STRIPE_PRO_PRICE_MONTH_BRL;
    expect(proPriceId("month", "BRL")).toEqual({ priceId: "price_usd_m", currency: "USD" });
    process.env.STRIPE_PRO_PRICE_MONTH_BRL = "price_brl_m";
    expect(proPriceId("month", "BRL")).toEqual({ priceId: "price_brl_m", currency: "BRL" });
  });

  it("reports billing unavailable until keys and a price exist", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(proBillingAvailable()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    delete process.env.STRIPE_PRO_PRICE_MONTH_USD;
    delete process.env.STRIPE_PRO_PRICE_YEAR_USD;
    expect(proBillingAvailable()).toBe(false);
    process.env.STRIPE_PRO_PRICE_YEAR_USD = "price_y";
    expect(proBillingAvailable()).toBe(true);
  });
});

describe("webhook routing", () => {
  it("ignores marketplace checkout sessions", async () => {
    const handled = await handleSubscriptionEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", mode: "payment" } },
    });
    expect(handled).toBe(false);
  });

  it("handles subscription lifecycle events (no DB → no-op, still handled)", async () => {
    const handled = await handleSubscriptionEvent({
      type: "customer.subscription.updated",
      data: {
        object: { id: "sub_1", customer: "cus_1", status: "active", current_period_end: 1_800_000_000 },
      },
    });
    expect(handled).toBe(true);
  });

  it("reads a subscription through the Stripe REST API", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("https://api.stripe.com/v1/subscriptions/sub_42");
      return new Response(
        JSON.stringify({ id: "sub_42", customer: "cus_9", status: "active", current_period_end: 1_900_000_000 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;
    const sub = await getSubscription("sub_42", fetchImpl);
    expect(sub.status).toBe("active");
    expect(planFromSubscription(sub).plan).toBe("pro");
  });
});
