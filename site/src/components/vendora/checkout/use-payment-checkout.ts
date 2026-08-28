"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clear_cart } from "@/redux/features/cartSlice";
import { clear_coupon } from "@/redux/features/coupon/couponSlice";
import { useAddOrderMutation } from "@/redux/features/order/orderApi";
import { reset_checkout, set_payment } from "@/redux/features/order/orderSlice";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { findShippingMethod } from "@/lib/vendora/shipping";
import type { Locale } from "@/lib/vendora/types";
import type { CartLine } from "@/components/vendora/cart/cart-model";
import {
  calculateCheckoutTotals,
  type CheckoutCoupon,
  type PaymentCheckoutPhase,
  type PaymentProviderId,
  type PersistedPaymentInfo,
} from "./checkout-model";
import type { ShippingAddressView } from "./checkout-components";

interface PaymentRootState {
  auth: { user?: { _id?: string; id?: string } };
  cart: { cart_products: CartLine[] };
  coupon: { coupon_info?: CheckoutCoupon };
  order: {
    shipping_info?: Record<string, unknown>;
    payment_info?: PersistedPaymentInfo;
  };
}

interface AddOrderResult {
  data?: { orderNumber?: string };
  error?: { data?: { message?: string } };
}

/** Coordinates client-side payment selection and the existing pending-order API. */
export function usePaymentCheckout() {
  const pathname = usePathname();
  const router = useRouter();
  const locale: Locale = getLocaleFromPathname(pathname);
  const dispatch = useDispatch();
  const { user } = useSelector((state: PaymentRootState) => state.auth);
  const items = useSelector((state: PaymentRootState) => state.cart.cart_products);
  const coupon = useSelector((state: PaymentRootState) => state.coupon.coupon_info);
  const shippingInfo = useSelector((state: PaymentRootState) => state.order.shipping_info ?? {});
  const persistedPayment = useSelector((state: PaymentRootState) => state.order.payment_info);
  const [addOrder] = useAddOrderMutation();
  const [provider, setProviderState] = useState<PaymentProviderId>(() => normalizeProvider(persistedPayment?.provider));
  const [notes, setNotesState] = useState(() => persistedPayment?.notes ?? String(shippingInfo.notes ?? ""));
  const [phase, setPhase] = useState<PaymentCheckoutPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const redirectTimer = useRef<number | null>(null);

  const shippingMethod = useMemo(
    () => findShippingMethod(String(shippingInfo.shippingMethodId ?? "post")),
    [shippingInfo.shippingMethodId],
  );
  const totals = useMemo(
    () => calculateCheckoutTotals(items, shippingMethod.cost, shippingMethod.paymentMode, coupon),
    [coupon, items, shippingMethod],
  );
  const shippingAddress = (shippingInfo.shippingAddress ?? null) as ShippingAddressView | null;
  const shippingCompleted = Boolean(shippingInfo.shippingAddressId && shippingInfo.shippingMethodId);

  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
  }, []);

  const setProvider = useCallback((value: PaymentProviderId) => {
    setProviderState(value);
    setPhase("idle");
    setErrorMessage("");
    dispatch(set_payment({ provider: value, notes }));
  }, [dispatch, notes]);

  const setNotes = useCallback((value: string) => {
    setNotesState(value);
    dispatch(set_payment({ provider, notes: value }));
  }, [dispatch, provider]);

  const submit = useCallback(async () => {
    if (phase === "submitting" || phase === "redirecting") return;
    if (!user?._id && !user?.id) {
      router.push(`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(withLocalePath("/checkout", locale))}`);
      return;
    }
    if (!shippingCompleted) {
      router.push(withLocalePath("/shipping", locale));
      return;
    }
    if (!provider) {
      setErrorMessage(locale === "fa" ? "لطفاً یک درگاه پرداخت انتخاب کنید." : "Choose a payment gateway.");
      setPhase("error");
      return;
    }

    setPhase("submitting");
    setErrorMessage("");
    dispatch(set_payment({ provider, notes }));

    const result = await addOrder({
      shippingCost: totals.shippingCost,
      discountAmount: totals.discount,
      shippingAddressId: shippingInfo.shippingAddressId,
      newAddress: null,
      items: items.map((item) => ({
        productId: item._id,
        quantity: item.orderQuantity || 1,
      })),
    }) as AddOrderResult;

    if (result.error || !result.data?.orderNumber) {
      setErrorMessage(result.error?.data?.message ?? (locale === "fa" ? "ثبت سفارش انجام نشد. دوباره تلاش کنید." : "The order could not be created. Try again."));
      setPhase("error");
      return;
    }

    const orderNumber = result.data.orderNumber;
    setPhase("redirecting");
    dispatch(clear_cart());
    dispatch(clear_coupon());
    dispatch(reset_checkout());
    redirectTimer.current = window.setTimeout(() => {
      router.push(withLocalePath(`/order/${orderNumber}`, locale));
    }, 900);
  }, [addOrder, dispatch, items, locale, notes, phase, provider, router, shippingCompleted, shippingInfo.shippingAddressId, totals.discount, totals.shippingCost, user]);

  return {
    locale,
    user,
    items,
    shippingInfo,
    shippingAddress,
    shippingMethod,
    shippingCompleted,
    totals,
    provider,
    setProvider,
    notes,
    setNotes,
    phase,
    errorMessage,
    submit,
  };
}

/** Restores a safe payment provider from persisted client state. */
function normalizeProvider(value?: string): PaymentProviderId {
  return value === "bankMelli" ? "bankMelli" : "zarinpal";
}
