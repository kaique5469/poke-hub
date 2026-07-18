import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  sellerShareCents,
  releaseOrder,
  refundOrderMoney,
  wasEventProcessed,
  recordEvent,
  getOrdersDueForRelease,
} from "./storeDb";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function ctxFor(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const buyer: AuthenticatedUser = {
  id: 10,
  openId: "buyer",
  email: "buyer@example.com",
  name: "Buyer",
  loginMethod: "email",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const admin: AuthenticatedUser = { ...buyer, id: 1, openId: "admin", role: "admin" };

// ─── Fee math: always integer cents ──────────────────────────────────────────
describe("sellerShareCents", () => {
  it("$100.00 → seller gets 9500c (5% fee = 500c)", () => {
    expect(sellerShareCents("100.00")).toBe(9500);
  });

  it("handles float-hostile totals in integer cents", () => {
    expect(sellerShareCents("0.10")).toBe(10 - Math.round(10 * 0.05)); // 9c ou 10c, sempre inteiro
    expect(Number.isInteger(sellerShareCents("19.99"))).toBe(true);
    expect(sellerShareCents("19.99")).toBe(1999 - Math.round(1999 * 0.05));
  });

  it("never returns negative or fractional values", () => {
    for (const v of ["0.01", "1.11", "33.33", "999999.99"]) {
      const share = sellerShareCents(v);
      expect(Number.isInteger(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(Math.round(parseFloat(v) * 100));
    }
  });
});

// ─── Safe no-ops without a database (nothing is ever paid out blindly) ──────
describe("escrow safety without DB", () => {
  it("releaseOrder is a no-op (false) when DB is unavailable", async () => {
    await expect(releaseOrder(123)).resolves.toBe(false);
  });

  it("refundOrderMoney is a no-op (false) when DB is unavailable", async () => {
    await expect(refundOrderMoney(123)).resolves.toBe(false);
  });

  it("auto-release finds nothing when DB is unavailable", async () => {
    await expect(getOrdersDueForRelease()).resolves.toEqual([]);
  });

  it("webhook idempotency helpers never throw", async () => {
    await expect(wasEventProcessed("evt_test_1")).resolves.toBe(false);
    await expect(recordEvent("evt_test_1", "checkout.session.completed")).resolves.toBeUndefined();
  });
});

// ─── confirmReceipt guards ───────────────────────────────────────────────────
describe("orders.confirmReceipt", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.orders.confirmReceipt({ orderId: 1 })).rejects.toThrow();
  });

  it("rejects when the order does not belong to the caller / does not exist", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(caller.orders.confirmReceipt({ orderId: 999999 })).rejects.toThrow(/not found/i);
  });

  it("rejects invalid orderId input", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(caller.orders.confirmReceipt({ orderId: -1 })).rejects.toThrow();
  });
});

describe("marketplace payment guards", () => {
  it("disables direct/off-platform checkout", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(caller.cart.checkout({})).rejects.toThrow(/off-platform/i);
  });

  it("does not let a seller mark an order paid manually", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(
      caller.orders.updateStatus({
        orderId: 1,
        // @ts-expect-error — Stripe webhook is the only paid transition
        status: "paid",
      })
    ).rejects.toThrow();
  });

  it("requires explicit buyer acceptance at secure checkout", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(
      caller.cart.stripeCheckout({
        // @ts-expect-error — literal true is required
        acceptMarketplaceTerms: false,
      })
    ).rejects.toThrow();
  });
});

// ─── Admin escrow router guards ──────────────────────────────────────────────
describe("escrow admin router", () => {
  it("blocks non-admin users from overview", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(caller.escrow.overview()).rejects.toThrow();
  });

  it("blocks non-admin users from resolveDispute", async () => {
    const caller = appRouter.createCaller(ctxFor(buyer));
    await expect(
      caller.escrow.resolveDispute({ orderId: 1, resolution: "refund_buyer" }),
    ).rejects.toThrow();
  });

  it("admin overview returns empty shape without DB", async () => {
    const caller = appRouter.createCaller(ctxFor(admin));
    await expect(caller.escrow.overview()).resolves.toEqual({
      held: [],
      disputed: [],
      ledger: [],
      totals: { heldCents: 0, releasedCents: 0 },
    });
  });

  it("rejects invalid dispute resolution values", async () => {
    const caller = appRouter.createCaller(ctxFor(admin));
    await expect(
      // @ts-expect-error — invalid enum on purpose
      caller.escrow.resolveDispute({ orderId: 1, resolution: "keep_money" }),
    ).rejects.toThrow();
  });
});
