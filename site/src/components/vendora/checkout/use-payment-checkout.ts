"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { sync_cart_prices } from "@/redux/features/cartSlice";
import { apiSlice } from "@/redux/api/apiSlice";
import { getCartUnitPrice } from "@/components/vendora/cart/cart-model";
import { useAddOrderMutation } from "@/redux/features/order/orderApi";
import { set_payment } from "@/redux/features/order/orderSlice";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { resolveShippingMethod } from "@/lib/vendora/shipping";
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
import { paymentErrorMessage, readPaymentAvailability, startTabaPay, type PaymentAvailability } from "@/lib/tabapay-client";

import { useShippingPolicy, shippingCartFingerprint } from "@/lib/shipping-client";

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
  const [provider, setProviderState] = useState<PaymentProviderId>("tabapay");
  const [notes, setNotesState] = useState(() => persistedPayment?.notes ?? String(shippingInfo.notes ?? ""));
  const [phase, setPhase] = useState<PaymentCheckoutPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [availability, setAvailability] = useState<PaymentAvailability | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    readPaymentAvailability(controller.signal).then(setAvailability).catch(() => {
      if (!controller.signal.aborted) setAvailability({ available: false, sandbox: false });
    });
    return () => controller.abort();
  }, []);

  const policy = useShippingPolicy();
  const shippingMethod = useMemo(
    () => resolveShippingMethod(String(shippingInfo.shippingMethodId ?? "post"), policy.includedInPrice, Number(shippingInfo.shippingCost) || 0),
    [shippingInfo.shippingMethodId, shippingInfo.shippingCost, policy.includedInPrice],
  );
  const estimatedTotals = useMemo(
    () => calculateCheckoutTotals(items, shippingMethod.cost, shippingMethod.paymentMode, coupon),
    [coupon, items, shippingMethod],
  );
  const savedTotals = shippingInfo.shippingServerTotals as { subtotal?: number; discount?: number; payable?: number } | undefined;
  const totals = shippingInfo.shippingPolicyVersion === policy.version && shippingInfo.shippingCartFingerprint === shippingCartFingerprint(items, coupon?.couponCode) && Number.isFinite(savedTotals?.payable)
    ? { ...estimatedTotals, subtotal: Number(savedTotals!.subtotal), discount: Number(savedTotals!.discount), payable: Number(savedTotals!.payable) }
    : estimatedTotals;
  const shippingAddress = (shippingInfo.shippingAddress ?? null) as ShippingAddressView | null;
  const [quoteNow, setQuoteNow] = useState(Date.now);
  useEffect(() => {
    const deadline = Date.parse(String(shippingInfo.shippingQuoteExpiresAtUtc));
    if (!Number.isFinite(deadline)) return;
    const timer = window.setTimeout(() => setQuoteNow(Date.now()), Math.max(0, deadline - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [shippingInfo.shippingQuoteExpiresAtUtc]);
  const shippingCompleted = Boolean(shippingInfo.shippingAddressId && shippingInfo.shippingMethodId &&
    shippingInfo.shippingPolicyVersion === policy.version && shippingInfo.shippingCartFingerprint === shippingCartFingerprint(items, coupon?.couponCode) &&
    (shippingInfo.shippingMethodId !== "freight" || items.reduce((sum, item) => sum + item.orderQuantity, 0) > 10) &&
    (!shippingMethod.requiresQuote || (shippingInfo.shippingQuoteId && Date.parse(String(shippingInfo.shippingQuoteExpiresAtUtc)) > quoteNow)));

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

  async function submit() {
    if (!policy.ready || policy.failed || !availability?.available || submitting.current || phase === "redirecting") return;
    if (!user?._id && !user?.id) {
      router.push(`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(withLocalePath("/checkout", locale))}`);
      return;
    }
    if (!shippingCompleted || (shippingMethod.requiresQuote && Date.parse(String(shippingInfo.shippingQuoteExpiresAtUtc)) <= Date.now())) {
      router.push(withLocalePath("/shipping", locale));
      return;
    }
    if (totals.payable < 10_000 || totals.payable > 50_000_000) {
      setErrorMessage(locale === "fa" ? "مبلغ قابل پرداخت با تاباپی باید بین ۱۰ هزار و ۵۰ میلیون تومان باشد." : "TabaPay supports totals between 10,000 and 50,000,000 toman.");
      setPhase("error");
      return;
    }

    setPhase("submitting");
    setErrorMessage("");
    dispatch(set_payment({ provider, notes }));

    const payload = {
      shippingMethod: shippingMethod.id,
      shippingQuoteId: shippingInfo.shippingQuoteId,
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
    submitting.current = true;
    try {
      // Retain the key across network failures and refresh; changed checkout input creates a new operation.
      const fingerprint = JSON.stringify({ payload, user: user?.id ?? user?._id });
      let attempt: { fingerprint: string; key: string } | null = null;
      try { attempt = JSON.parse(sessionStorage.getItem("vendora-order-attempt") ?? "null"); } catch { /* Invalid local metadata is not trusted. */ }
      const key = attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
      sessionStorage.setItem("vendora-order-attempt", JSON.stringify({ fingerprint, key }));
      const result = await addOrder({ ...payload, idempotencyKey: key, retainCheckout: true }) as AddOrderResult;

      if (result.error || !result.data?.orderNumber) {
        if (result.error?.data?.code === 'PROFILE_INCOMPLETE') {
          setPhase('idle'); router.push(completeProfileHref(locale, withLocalePath('/checkout', locale))); return;
        }
        if (result.error?.data?.code === "PRICE_CHANGED") {
          const { productId, currentPrice } = result.error.data;
          if (productId && currentPrice) dispatch(sync_cart_prices([{ _id: productId, originalPrice: currentPrice, price: currentPrice, discount: 0 }]));
          dispatch(apiSlice.util.invalidateTags(["Products", "Discount", "Product", "RelatedProducts"]));
          setErrorMessage(locale === "fa" ? "قیمت محصول به‌روز شد. مبلغ سفارش را بررسی و دوباره تأیید کنید." : "Product prices were updated. Review the new total and confirm again.");
          setPhase("error");
          return;
        }
        setErrorMessage(result.error?.data?.message ?? (locale === "fa" ? "ثبت سفارش انجام نشد. دوباره تلاش کنید." : "The order could not be created. Try again."));
        setPhase("error");
        return;
      }

      setOrderNumber(result.data.orderNumber);
      sessionStorage.setItem("vendora-payment-cart", JSON.stringify({
        orderNumber: result.data.orderNumber,
        user: user.id ?? user._id,
        fingerprint: shippingCartFingerprint(items, coupon?.couponCode),
      }));
      const url = await startTabaPay(result.data.orderNumber, locale);
      setPhase("redirecting");
      window.location.assign(url);
    } catch (error) {
      setErrorMessage(paymentErrorMessage(error, locale));
      setPhase("error");
    } finally {
      submitting.current = false;
    }
  }

  return {
    locale,
    user,
    items,
    shippingInfo,
    shippingAddress,
    shippingMethod,
    shippingCompleted,
    shippingPolicyReady: policy.ready && !policy.failed,
    shippingPolicyFailed: policy.failed,
    totals,
    provider,
    availability,
    orderNumber,
    setProvider,
    notes,
    setNotes,
    phase,
    errorMessage,
    submit,
  };
}
