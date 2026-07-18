import { describe, expect, it } from "vitest";
import { getTrackingUrl } from "@shared/tracking";

describe("marketplace tracking links", () => {
  it("uses carrier-owned HTTPS destinations", () => {
    expect(getTrackingUrl("usps", "9400 1118")).toBe(
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201118"
    );
    expect(getTrackingUrl("ups", "1Z999AA10123456784")).toContain(
      "https://www.ups.com/track?tracknum="
    );
    expect(getTrackingUrl("fedex", "123456789012")).toContain(
      "https://www.fedex.com/fedextrack/?trknbr="
    );
  });

  it("does not create an untrusted link for an unspecified carrier", () => {
    expect(getTrackingUrl("other", "TRACK-1")).toBeNull();
    expect(getTrackingUrl("usps", "")).toBeNull();
  });
});
