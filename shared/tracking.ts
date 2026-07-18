export const TRACKING_CARRIERS = ["usps", "ups", "fedex", "other"] as const;

export type TrackingCarrier = (typeof TRACKING_CARRIERS)[number];

export const TRACKING_CARRIER_LABELS: Record<TrackingCarrier, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  other: "Other carrier",
};

/**
 * Provider-owned tracking URLs. The tracking number is encoded and never
 * interpolated into arbitrary URLs supplied by a seller.
 */
export function getTrackingUrl(
  carrier: TrackingCarrier | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  const number = trackingNumber?.trim();
  if (!number || !carrier || carrier === "other") return null;
  const encoded = encodeURIComponent(number);
  if (carrier === "ups") {
    return `https://www.ups.com/track?tracknum=${encoded}`;
  }
  if (carrier === "fedex") {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  }
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
}
