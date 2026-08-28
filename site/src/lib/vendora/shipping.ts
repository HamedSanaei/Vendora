import type { Locale } from "./types";

export type ShippingMethodId = "post" | "tipax" | "freight";
export type ShippingPaymentMode = "prepaid" | "collect";

export interface ShippingMethod {
  id: ShippingMethodId;
  title: string;
  titleEn: string;
  deliveryTime: string;
  deliveryTimeEn: string;
  paymentMode: ShippingPaymentMode;
  cost: number;
}

/**
 * Shipping choices shared by the Shipping page and the payment handoff.
 * Prices are the current storefront defaults and can be replaced centrally
 * when a server-side rate service becomes available.
 */
export const shippingMethods: readonly ShippingMethod[] = [
  {
    id: "post",
    title: "پست پیشتاز",
    titleEn: "Express post",
    deliveryTime: "۴ تا ۶ روز کاری",
    deliveryTimeEn: "4 to 6 business days",
    paymentMode: "prepaid",
    cost: 60000,
  },
  {
    id: "tipax",
    title: "تیپاکس",
    titleEn: "Tipax",
    deliveryTime: "۳ تا ۵ روز کاری",
    deliveryTimeEn: "3 to 5 business days",
    paymentMode: "prepaid",
    cost: 20000,
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
