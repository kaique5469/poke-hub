import {
  createDecipheriv,
  createECDH,
  createHmac,
  randomBytes,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  dropRetailerCurrency,
  dropRetailerTimezone,
  normalizeProductUrl,
  productMatchesQuery,
} from "../shared/drops";
import {
  classifyDropTransition,
  isWithinDropWindow,
  timeInZone,
} from "./dropMonitor";
import {
  parseDropProviderPayload,
  parseDropProviderProduct,
} from "./dropProvider";
import { ENV } from "./_core/env";
import { verifyDropProviderSignature } from "./dropProviderWebhook";
import { encryptWebPushPayload } from "./webPush";

describe("drop release windows", () => {
  it("uses the configured retailer timezone instead of the server timezone", () => {
    const now = new Date("2026-08-20T00:59:00.000Z");
    expect(timeInZone(now, "America/New_York")).toEqual({
      weekday: 3,
      minute: 20 * 60 + 59,
    });
    expect(
      isWithinDropWindow(now, {
        timezone: "America/New_York",
        weekday: 3,
        startMinute: 20 * 60 + 55,
        endMinute: 21 * 60 + 15,
        isActive: true,
      })
    ).toBe(true);
  });

  it("supports a release window that crosses midnight", () => {
    const now = new Date("2026-08-20T04:05:00.000Z");
    expect(
      isWithinDropWindow(now, {
        timezone: "America/New_York",
        weekday: 3,
        startMinute: 23 * 60 + 55,
        endMinute: 15,
        isActive: true,
      })
    ).toBe(true);
  });
});

describe("drop transition detection", () => {
  it("alerts once for a new product and once for a later restock", () => {
    expect(classifyDropTransition(null, "in_stock")).toBe("new_product");
    expect(classifyDropTransition("in_stock", "in_stock")).toBeNull();
    expect(classifyDropTransition("out_of_stock", "in_stock")).toBe("restock");
    expect(classifyDropTransition("out_of_stock", "preorder")).toBe("preorder");
  });

  it("requires every meaningful query token", () => {
    expect(
      productMatchesQuery(
        "Pokémon TCG Ascended Heroes Elite Trainer Box",
        "Ascended Heroes ETB"
      )
    ).toBe(true);
    expect(
      productMatchesQuery(
        "Pokémon TCG Ascended Heroes Elite Trainer Box",
        "Ascended Heroes"
      )
    ).toBe(true);
  });
});

describe("authorized provider contract", () => {
  it("canonicalizes retailer tracking parameters and enforces the real domain", () => {
    expect(
      normalizeProductUrl(
        "walmart",
        "https://www.walmart.com/ip/pokemon/123?utm_source=test&ref=affiliate"
      )
    ).toBe("https://www.walmart.com/ip/pokemon/123");
    expect(
      normalizeProductUrl("safari_zone", "https://safari-zone.com/products/test")
    ).toBe("https://safari-zone.com/products/test");
    expect(
      normalizeProductUrl(
        "mercado_livre",
        "https://produto.mercadolivre.com.br/MLB-123-test"
      )
    ).toBe("https://produto.mercadolivre.com.br/MLB-123-test");
    expect(dropRetailerCurrency("copag")).toBe("BRL");
    expect(dropRetailerTimezone("copag")).toBe("America/Sao_Paulo");
  });

  it("accepts normalized products from expanded major retailers", () => {
    const product = parseDropProviderProduct({
      retailer: "gamestop",
      retailerProductId: "sku-123",
      title: "Pokémon TCG Booster Bundle",
      productUrl: "https://www.gamestop.com/toys-games/trading-cards/products/test/123.html",
      stockState: "in_stock",
      priceCents: 2899,
      currency: "USD",
      observedAt: new Date().toISOString(),
      source: "licensed-feed",
    });
    expect(product?.retailer).toBe("gamestop");
    expect(product?.priceCents).toBe(2899);
  });

  it("defaults Brazilian retailer inventory to BRL", () => {
    const product = parseDropProviderProduct({
      retailer: "copag",
      retailerProductId: "box-123",
      title: "Pokémon TCG Box Premium",
      productUrl: "https://www.copagloja.com.br/pokemon/box-123",
      stockState: "in_stock",
      priceCents: 19990,
      observedAt: new Date().toISOString(),
      source: "licensed-feed",
    });
    expect(product?.currency).toBe("BRL");
  });

  it("rejects lookalike and cross-retailer product URLs", () => {
    expect(
      parseDropProviderProduct({
        retailer: "target",
        retailerProductId: "123",
        title: "Pokémon ETB",
        productUrl: "https://target.com.evil.example/p/123",
        stockState: "in_stock",
      })
    ).toBeNull();
  });

  it("caps provider batches to protect the worker", () => {
    expect(() =>
      parseDropProviderPayload({ products: Array.from({ length: 101 }) })
    ).toThrow(/100 products/);
  });
});

describe("drop provider webhook authentication", () => {
  it("accepts a current HMAC signature and rejects tampering", () => {
    const originalSecret = ENV.dropProviderWebhookSecret;
    ENV.dropProviderWebhookSecret = "test-webhook-secret";
    const body = Buffer.from('{"products":[]}');
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const signature = createHmac("sha256", ENV.dropProviderWebhookSecret)
      .update(`${timestamp}.`)
      .update(body)
      .digest("hex");
    expect(
      verifyDropProviderSignature({
        body,
        timestamp,
        signature: `sha256=${signature}`,
      })
    ).toBe(true);
    expect(
      verifyDropProviderSignature({
        body: Buffer.from('{"products":[1]}'),
        timestamp,
        signature: `sha256=${signature}`,
      })
    ).toBe(false);
    ENV.dropProviderWebhookSecret = originalSecret;
  });
});

describe("native Web Push encryption", () => {
  it("creates a valid aes128gcm record that the subscriber can decrypt", () => {
    const client = createECDH("prime256v1");
    client.generateKeys();
    const payload = Buffer.from('{"title":"Drop"}');
    const auth = randomBytes(16);
    const encrypted = encryptWebPushPayload({
      payload,
      clientPublicKey: client.getPublicKey().toString("base64url"),
      authSecret: auth.toString("base64url"),
    });
    expect(encrypted.subarray(16, 20).readUInt32BE(0)).toBe(4096);
    expect(encrypted[20]).toBe(65);
    expect(encrypted[21]).toBe(4);
    expect(encrypted.length).toBeGreaterThan(payload.length + 86);

    const hmac = (key: Buffer, value: Buffer) =>
      createHmac("sha256", key).update(value).digest();
    const expand = (prk: Buffer, info: Buffer, length: number) => {
      let output = Buffer.alloc(0);
      let previous = Buffer.alloc(0);
      for (let counter = 1; output.length < length; counter += 1) {
        previous = hmac(
          prk,
          Buffer.concat([previous, info, Buffer.from([counter])])
        );
        output = Buffer.concat([output, previous]);
      }
      return output.subarray(0, length);
    };
    const salt = encrypted.subarray(0, 16);
    const serverPublic = encrypted.subarray(21, 86);
    const sharedSecret = client.computeSecret(serverPublic);
    const authPrk = hmac(auth, sharedSecret);
    const ikm = expand(
      authPrk,
      Buffer.concat([
        Buffer.from("WebPush: info\0"),
        client.getPublicKey(),
        serverPublic,
      ]),
      32
    );
    const prk = hmac(salt, ikm);
    const contentKey = expand(
      prk,
      Buffer.from("Content-Encoding: aes128gcm\0"),
      16
    );
    const nonce = expand(
      prk,
      Buffer.from("Content-Encoding: nonce\0"),
      12
    );
    const ciphertextWithTag = encrypted.subarray(86);
    const decipher = createDecipheriv("aes-128-gcm", contentKey, nonce);
    decipher.setAuthTag(ciphertextWithTag.subarray(-16));
    const plaintext = Buffer.concat([
      decipher.update(ciphertextWithTag.subarray(0, -16)),
      decipher.final(),
    ]);
    expect(plaintext.subarray(0, -1)).toEqual(payload);
    expect(plaintext.at(-1)).toBe(2);
  });
});
