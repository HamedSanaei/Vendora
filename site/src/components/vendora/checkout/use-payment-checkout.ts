"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clear_cart } from "@/redux/features/cartSlice";
import { sync_cart_prices } from "@/redux/features/cartSlice";
import { apiSlice } from "@/redux/api/apiSlice";
import { getCartUnitPrice } from "@/components/vendora/cart/cart-model";
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
import { completeProfileHref } from '@/lib/auth/customer-profile';

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
  error?: { data?: { message?: string; code?: string; productId?: string; currentPrice?: number } };
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

    const payload = {
      shippingMethod: shippingMethod.id,
      couponCode: coupon?.couponCode,
      shippingCost: totals.shippingCost,
      discountAmount: totals.discount,
      shippingAddressId: shippingInfo.shippingAddressId,
      newAddress: null,
      items: items.map((item) => ({
        productId: item._id,
        quantity: item.orderQuantity || 1,
        expectedUnitPrice: getCartUnitPrice(item),
      })),
    };
    // Retain the key across network failures and refresh; changed checkout input creates a new operation.
    const fingerprint = JSON.stringify({ payload, user: user?.id ?? user?._id });
    let attempt: { fingerprint: string; key: string } | null = null;
    try { attempt = JSON.parse(sessionStorage.getItem("vendora-order-attempt") ?? "null"); } catch { /* Invalid local metadata is not trusted. */ }
    const key = attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    sessionStorage.setItem("vendora-order-attempt", JSON.stringify({ fingerprint, key }));
    const result = await addOrder({ ...payload, idempotencyKey: key }) as AddOrderResult;

    if (result.error || !result.data?.orderNumber) {
      if (result.error?.data?.code === 'PROFILE_INCOMPLETE') {
        setPhase('idle'); router.push(completeProfileHref(locale, withLocalePath('/checkout', locale))); return;
      }
      if (result.error?.data?.code === "PRICE_CHANGED") {
        const { productId, currentPrice } = result.error.data;
        if (productId && currentPrice) dispatch(sync_cart_prices([{ _id: productId, originalPrice: currentPrice, price: currentPrice, discount: 0 }]));
        dispatch(apiSlice.util.invalidateTags(["Products", "Product", "RelatedProducts"]));
        setErrorMessage(locale === "fa" ? "قیمت محصول با نرخ داخلی جدید به‌روز شد. مبلغ سفارش را بررسی و دوباره تأیید کنید." : "Product prices were updated. Review the new total and confirm again.");
        setPhase("error");
        return;
      }
      setErrorMessage(result.error?.data?.message ?? (locale === "fa" ? "ثبت سفارش انجام نشد. دوباره تلاش کنید." : "The order could not be created. Try again."));
      setPhase("error");
      return;
    }

    const orderNumber = result.data.orderNumber;
    sessionStorage.removeItem("vendora-order-attempt");
    setPhase("redirecting");
    dispatch(clear_cart());
    dispatch(clear_coupon());
    dispatch(reset_checkout());
    redirectTimer.current = window.setTimeout(() => {
      router.push(withLocalePath(`/order/${orderNumber}`, locale));
    }, 900);
  }, [addOrder, dispatch, items, locale, notes, phase, provider, router, shippingCompleted, shippingInfo.shippingAddressId, shippingMethod.id, coupon?.couponCode, totals.discount, totals.shippingCost, user]);

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
