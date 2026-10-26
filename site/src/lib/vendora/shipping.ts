import type { Locale } from "./types";

export type ShippingMethodId = "post" | "tipax" | "freight";
export type ShippingPaymentMode = "prepaid" | "collect" | "free";

export interface ShippingMethod {
  id: ShippingMethodId;
  title: string;
  titleEn: string;
  deliveryTime: string;
  deliveryTimeEn: string;
  paymentMode: ShippingPaymentMode;
  cost: number;
  requiresQuote?: boolean;
}

/**
 * Shipping choices shared by the Shipping page and the payment handoff.
 * Delivery charges are supplied by the server policy/quote, never static tariffs.
 */
export const shippingMethods: readonly ShippingMethod[] = [
  {
    id: "post",
    title: "پست پیشتاز",
    titleEn: "Express post",
    deliveryTime: "۴ تا ۶ روز کاری",
    deliveryTimeEn: "4 to 6 business days",
    paymentMode: "prepaid",
    cost: 0,
    requiresQuote: true,
  },
  {
    id: "tipax",
    title: "تیپاکس",
    titleEn: "Tipax",
    deliveryTime: "۳ تا ۵ روز کاری",
    deliveryTimeEn: "3 to 5 business days",
    paymentMode: "collect",
    cost: 0,
  },
  {
    id: "freight",
    title: "باربری همراه بیمه",
    titleEn: "Insured freight",
    deliveryTime: "۳ تا ۵ روز کاری",
    deliveryTimeEn: "3 to 5 business days",
    paymentMode: "collect",
    cost: 0,
  },
];

/** Returns the display title for a method in the active locale. */
export function getShippingMethodTitle(method: ShippingMethod, locale: Locale): string {
  return locale === "fa" ? method.title : method.titleEn;
}

/** Returns the display delivery window for a method in the active locale. */
export function getShippingDeliveryTime(method: ShippingMethod, locale: Locale): string {
  return locale === "fa" ? method.deliveryTime : method.deliveryTimeEn;
}

/** Returns a method by id, falling back to the first configured choice. */
export function findShippingMethod(id?: string | null): ShippingMethod {
  return shippingMethods.find((method) => method.id === id) ?? shippingMethods[0];
}

/** Resolves policy and saved quote without treating unpaid collect charges as free shipping. */
export function resolveShippingMethod(id: string, included: boolean, cost = 0): ShippingMethod {
  const method = findShippingMethod(id);
  return { ...method, paymentMode: included ? "free" : method.id === "post" ? "prepaid" : "collect", cost: included ? 0 : cost, requiresQuote: !included && method.id === "post" };
}
