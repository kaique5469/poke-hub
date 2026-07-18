export const MARKETPLACE_TERMS_VERSION = "2026-07-18";
export const CHECKOUT_RESERVATION_MINUTES = 30;

export const ORDER_DISPUTE_REASONS = [
  "item_not_received",
  "not_as_described",
  "suspected_counterfeit",
  "damaged_in_transit",
  "other",
] as const;

export type OrderDisputeReason = (typeof ORDER_DISPUTE_REASONS)[number];

export interface ShippingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
