import { getCartUnitPrice, type CartLine } from "@/components/vendora/cart/cart-model";
import type { ShippingPaymentMode } from "@/lib/vendora/shipping";

export type PaymentProviderId = "zarinpal" | "bankMelli";
export type PaymentCheckoutPhase = "idle" | "submitting" | "redirecting" | "error";
export type CheckoutComponentState = "default" | "selected" | "focus" | "disabled" | "error";
export type CheckoutComponentSize = "regular" | "compact";

export interface PersistedPaymentInfo {
  provider: PaymentProviderId;
  notes: string;
}

export interface CheckoutCoupon {
  discountPercentage?: number | string;
  minimumAmount?: number | string;
  productType?: string;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  shippingCost: number;
  payable: number;
  shippingPayment: ShippingPaymentMode;
}

/** Calculates authoritative storefront display totals from the current cart and persisted checkout choices. */
export function calculateCheckoutTotals(
  items: CartLine[],
  shippingCost: number,
  shippingPayment: ShippingPaymentMode,
  coupon?: CheckoutCoupon,
): CheckoutTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + getCartUnitPrice(item) * (Number(item.orderQuantity) || 0),
    0,
  );
  const percentage = clamp(Number(coupon?.discountPercentage) || 0, 0, 100);
  const minimumAmount = Math.max(0, Number(coupon?.minimumAmount) || 0);
  const productType = coupon?.productType?.trim();
  const eligibleSubtotal = productType
    ? items
        .filter((item) => item.type === productType)
        .reduce(
          (sum, item) => sum + getCartUnitPrice(item) * (Number(item.orderQuantity) || 0),
          0,
        )
    : subtotal;
  const discount = subtotal >= minimumAmount ? eligibleSubtotal * (percentage / 100) : 0;
  const prepaidShipping = shippingPayment === "prepaid" ? Math.max(0, shippingCost) : 0;

  return {
    subtotal,
    discount,
    shippingCost: prepaidShipping,
    payable: Math.max(0, subtotal + prepaidShipping - discount),
    shippingPayment,
  };
}

/** Constrains a numeric coupon value to its supported range. */
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
