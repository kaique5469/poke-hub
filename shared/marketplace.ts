export const MARKETPLACE_TERMS_VERSION = "2026-07-18";
export const CHECKOUT_RESERVATION_MINUTES = 30;

export interface ShippingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
