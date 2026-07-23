export const MARKETPLACE_TERMS_VERSION = "2026-07-20-BR";
export const CHECKOUT_RESERVATION_MINUTES = 30;
export const MARKETPLACE_COUNTRY = "BR" as const;
export const MARKETPLACE_CURRENCY = "BRL" as const;
export const MARKETPLACE_BUSINESS_TYPE = "individual" as const;
export const MARKETPLACE_PLATFORM_FEE_BPS = 500;

export function formatMarketplaceMoney(value: string | number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: MARKETPLACE_CURRENCY,
  }).format(Number(value));
}

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
