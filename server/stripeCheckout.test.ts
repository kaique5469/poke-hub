import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  createRefund,
  expireCheckoutSession,
  getCheckoutSessionStatus,
  getSessionPaymentDetails,
  stripeEnabled,
} from "./lib/stripe";

const fetchMock = vi.fn();

function stripeResponse(payload: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe("Stripe marketplace checkout", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_raritygrid";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_raritygrid";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("collects US shipping and creates a 30-minute card reservation", async () => {
    fetchMock.mockResolvedValueOnce(
      stripeResponse({ id: "cs_test_1", url: "https://checkout.stripe.test/1" })
    );
    const before = Date.now();
    const session = await createCheckoutSession({
      amountUsd: 19.99,
      description: "RarityGrid order",
      orderIds: [41, 42],
      buyerEmail: "buyer@example.com",
      origin: "https://raritygrid.com",
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(request.body));
    expect(body.get("payment_method_types[0]")).toBe("card");
    expect(body.get("shipping_address_collection[allowed_countries][0]")).toBe(
      "US"
    );
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("1999");
    expect(body.get("metadata[orderIds]")).toBe("41,42");
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "checkout_41_42",
    });
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 29 * 60_000
    );
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
      before + 31 * 60_000
    );
  });

  it("refunds only the affected order amount", async () => {
    fetchMock.mockResolvedValueOnce(stripeResponse({ id: "re_partial" }));
    await expect(
      createRefund("ch_cart", 1234, "refund_order_42")
    ).resolves.toBe("re_partial");
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith("/refunds")).toBe(true);
    const body = new URLSearchParams(String(request.body));
    expect(body.get("charge")).toBe("ch_cart");
    expect(body.get("amount")).toBe("1234");
  });

  it("expires an unusable checkout session", async () => {
    fetchMock.mockResolvedValueOnce(stripeResponse({ id: "cs_test_1" }));
    await expect(expireCheckoutSession("cs_test_1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/checkout/sessions/cs_test_1/expire"
    );
  });

  it("reads the paid charge and current Stripe shipping structure", async () => {
    fetchMock.mockResolvedValueOnce(
      stripeResponse({
        payment_intent: { latest_charge: "ch_paid" },
        collected_information: {
          shipping_details: {
            name: "Buyer Name",
            phone: "+13055550123",
            address: {
              line1: "123 Main St",
              line2: "Apt 4",
              city: "Miami",
              state: "FL",
              postal_code: "33101",
              country: "US",
            },
          },
        },
      })
    );
    await expect(getSessionPaymentDetails("cs_paid")).resolves.toEqual({
      chargeId: "ch_paid",
      shippingName: "Buyer Name",
      shippingPhone: "+13055550123",
      shippingAddress: {
        line1: "123 Main St",
        line2: "Apt 4",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "US",
      },
    });
  });

  it("reconciles the authoritative Stripe checkout status before restocking", async () => {
    fetchMock.mockResolvedValueOnce(
      stripeResponse({ status: "complete", payment_status: "paid" })
    );
    await expect(getCheckoutSessionStatus("cs_paid")).resolves.toEqual({
      status: "complete",
      paymentStatus: "paid",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/checkout/sessions/cs_paid");
  });

  it("rejects an unknown checkout state instead of guessing", async () => {
    fetchMock.mockResolvedValueOnce(
      stripeResponse({ status: "mystery", payment_status: "paid" })
    );
    await expect(getCheckoutSessionStatus("cs_unknown")).rejects.toThrow(
      /unknown Checkout Session status/i
    );
  });

  it("rejects invalid refund amounts before contacting Stripe", async () => {
    await expect(createRefund("ch_cart", 0)).rejects.toThrow(/invalid refund/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not advertise checkout without webhook verification", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(stripeEnabled()).toBe(false);
  });
});
