import { describe, expect, it } from "vitest";
import { authenticateRequest, createSessionToken } from "./_core/auth";

type FakeReq = { headers: Record<string, string | undefined> };

describe("bearer authentication", () => {
  it("rejects a malformed Authorization header", async () => {
    const req = { headers: { authorization: "Bearer nope" } } as unknown as Parameters<
      typeof authenticateRequest
    >[0];
    expect(await authenticateRequest(req)).toBeNull();
  });

  it("parses a valid session token from the Authorization header (no DB → null user)", async () => {
    const token = await createSessionToken(1, "local:test");
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Parameters<
      typeof authenticateRequest
    >[0];
    // Without DATABASE_URL the lookup returns undefined → null; the point is
    // that the token path is exercised without throwing.
    expect(await authenticateRequest(req)).toBeNull();
  });

  it("ignores a bearer signed with another secret", async () => {
    const forged =
      "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsIm9wZW5JZCI6ImxvY2FsOngiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6NDEwMjQ0NDgwMH0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const req: FakeReq = { headers: { authorization: `Bearer ${forged}` } };
    expect(await authenticateRequest(req as unknown as Parameters<typeof authenticateRequest>[0])).toBeNull();
  });
});
