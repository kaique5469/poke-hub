import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn().mockResolvedValue({
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "email",
      role: "user" as const,
      username: null,
      bio: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }),
    getBinderCards: vi.fn().mockResolvedValue([
      {
        id: 1,
        userId: 1,
        cardId: "sv1-1",
        cardName: "Bulbasaur",
        setName: "Scarlet & Violet",
        setId: "sv1",
        imageUrl: "https://example.com/bulbasaur.png",
        rarity: "Common",
        quantity: 2,
        condition: "NM" as const,
        priceUsd: "0.50",
        notes: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    addBinderCard: vi.fn().mockResolvedValue(undefined),
    updateBinderCard: vi.fn().mockResolvedValue(undefined),
    removeBinderCard: vi.fn().mockResolvedValue(undefined),
    getUserDecks: vi.fn().mockResolvedValue([]),
    getPublicDecks: vi.fn().mockResolvedValue([]),
    getDeckById: vi.fn().mockResolvedValue(null),
    getDeckCards: vi.fn().mockResolvedValue([]),
    createDeck: vi.fn().mockResolvedValue({ insertId: 42 }),
    updateDeck: vi.fn().mockResolvedValue(undefined),
    deleteDeck: vi.fn().mockResolvedValue(undefined),
    upsertDeckCards: vi.fn().mockResolvedValue(undefined),
    getUserAlerts: vi.fn().mockResolvedValue([]),
    createAlert: vi.fn().mockResolvedValue(undefined),
    updateAlert: vi.fn().mockResolvedValue(undefined),
    deleteAlert: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Auth context factory ─────────────────────────────────────────────────────
function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "email",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Binder CRUD ──────────────────────────────────────────────────────────────
describe("binder procedures", () => {
  it("lists binder cards for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.binder.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.cardName).toBe("Bulbasaur");
  });

  it("adds a card to the binder", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.binder.add({
      cardId: "sv1-1",
      cardName: "Bulbasaur",
      setName: "Scarlet & Violet",
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("updates a binder card quantity", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.binder.update({ id: 1, quantity: 3 });
    expect(result.success).toBe(true);
  });

  it("stores collector cost basis fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.binder.update({
      id: 1,
      purchasePriceUsd: 12.5,
      acquisitionSource: "purchase",
      gradingCompany: "PSA",
      grade: 9.5,
    });
    expect(result.success).toBe(true);
  });

  it("removes a card from the binder", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.binder.remove({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects add with invalid quantity (0)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.binder.add({ cardId: "sv1-1", cardName: "Bulbasaur", quantity: 0 })
    ).rejects.toThrow();
  });

  it("rejects add with quantity over 99", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.binder.add({
        cardId: "sv1-1",
        cardName: "Bulbasaur",
        quantity: 100,
      })
    ).rejects.toThrow();
  });

  it("caps CSV imports at 100 rows", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.binder.importCsv({
        rows: Array.from({ length: 101 }, (_, index) => ({
          cardId: `sv1-${index + 1}`,
          quantity: 1,
          condition: "NM" as const,
        })),
      })
    ).rejects.toThrow();
  });
});

// ─── Deck validation ──────────────────────────────────────────────────────────
describe("deck procedures", () => {
  it("creates a deck with valid input", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.decks.create({
      name: "Test Deck",
      format: "standard",
      isPublic: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a deck name that is too short", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.decks.create({ name: "", format: "standard", isPublic: false })
    ).rejects.toThrow();
  });

  it("rejects an invalid format", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.decks.create({
        name: "My Deck",
        format: "invalid-format" as "standard",
        isPublic: false,
      })
    ).rejects.toThrow();
  });

  it("lists user decks", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.decks.myDecks();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Drop Alerts ─────────────────────────────────────────────────────────────
describe("alerts procedures", () => {
  it("lists alerts for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.alerts.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates an alert with valid retailer", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.alerts.create({
      productName: "Prismatic Evolutions ETB",
      retailer: "pokemon_center",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an alert with invalid retailer", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.alerts.create({
        productName: "Test Product",
        retailer: "walmart" as "amazon",
      })
    ).rejects.toThrow();
  });

  it("rejects an alert with empty product name", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.alerts.create({ productName: "", retailer: "amazon" })
    ).rejects.toThrow();
  });
});
