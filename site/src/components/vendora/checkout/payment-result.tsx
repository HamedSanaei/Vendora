"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { VendoraButton } from "@/components/vendora/ui/button";
import type { CartLine } from "@/components/vendora/cart/cart-model";
import { paymentErrorMessage, readTabaPayResult, recheckTabaPay, startTabaPay, type PaymentResult } from "@/lib/tabapay-client";
import { shippingCartFingerprint } from "@/lib/shipping-client";
import type { Locale } from "@/lib/vendora/types";
import { clear_cart } from "@/redux/features/cartSlice";
import { clear_coupon } from "@/redux/features/coupon/couponSlice";
import { reset_checkout } from "@/redux/features/order/orderSlice";

interface PaymentResultState {
  auth: { user?: { id?: string; _id?: string } };
  cart: { cart_products: CartLine[] };
  coupon: { coupon_info?: { couponCode?: string } };
}

/** Shows verified server state on the existing order page and offers a safe retry for that same order. */
export function PaymentResultPanel({ orderNumber, locale }: { orderNumber: string; locale: Locale }) {
  const fa = locale === "fa";
  const dispatch = useDispatch();
  const user = useSelector((state: PaymentResultState) => state.auth.user);
  const items = useSelector((state: PaymentResultState) => state.cart.cart_products);
  const coupon = useSelector((state: PaymentResultState) => state.coupon.coupon_info?.couponCode);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    readTabaPayResult(orderNumber, controller.signal).then(setResult).catch(error => {
      if (!controller.signal.aborted) setError(paymentErrorMessage(error, locale));
    });
    return () => controller.abort();
  }, [locale, orderNumber]);

  useEffect(() => {
    if (result?.state !== "paid") return;
    try {
      const saved = JSON.parse(sessionStorage.getItem("vendora-payment-cart") ?? "null");
      if (!saved || saved.orderNumber !== orderNumber || !user || saved.user !== (user.id ?? user._id)) return;
      sessionStorage.removeItem("vendora-payment-cart");
      sessionStorage.removeItem("vendora-order-attempt");
      if (saved.fingerprint !== shippingCartFingerprint(items, coupon)) return;
      dispatch(clear_cart());
      dispatch(clear_coupon());
      dispatch(reset_checkout());
    } catch { /* Invalid or unavailable browser storage must never discard a different cart. */ }
  }, [coupon, dispatch, items, orderNumber, result?.state, user]);

  /** Checks payment without creating a new order or token, or resumes the existing order's payment. */
  async function act(retry: boolean) {
    setBusy(true);
    setError("");
    try {
      if (retry) { window.location.assign(await startTabaPay(orderNumber, locale)); return; }
      setResult(await recheckTabaPay(orderNumber, locale));
    } catch (error) { setError(paymentErrorMessage(error, locale)); }
    finally { setBusy(false); }
  }

  const messages = {
    paid: fa ? "پرداخت سفارش تأیید شد." : "Order payment verified.",
    review: fa ? "پرداخت دریافت شده و سفارش در حال بررسی است." : "Payment was received and the order is under review.",
    pending: fa ? "پرداخت سفارش در انتظار تأیید است." : "Order payment is awaiting verification.",
    failed: fa ? "پرداخت سفارش تکمیل نشد." : "Order payment was not completed.",
    cancelled: fa ? "سفارش بسته شده است." : "The order is closed.",
  };
  return (
    <section className="mb-5 rounded-card border border-vd-line bg-surface-soft p-4 md:p-6" dir={fa ? "rtl" : "ltr"} aria-label={fa ? "وضعیت پرداخت" : "Payment status"}>
      <p className="text-base font-extrabold text-ink" role="status">
        {result ? messages[result.state] : error || (fa ? "در حال دریافت وضعیت پرداخت…" : "Checking payment status…")}
      </p>
      {result?.reference && <p className="mt-2 text-sm text-vd-muted">
        {fa ? "شماره مرجع پرداخت" : "Payment reference"} <bdi className="font-semibold">{result.reference}</bdi>
      </p>}
      {result && error && <p className="mt-2 text-sm text-vd-danger" role="alert">{error}</p>}
      {(!result || result.state === "pending" || result.state === "review" || result.state === "failed") &&
        <div className="mt-4 flex flex-wrap gap-3">
          {result?.canRetry && <VendoraButton type="button" disabled={busy} onClick={() => void act(true)}>
            {fa ? "ادامهٔ پرداخت" : "Continue payment"}
          </VendoraButton>}
          {(result || error) && <VendoraButton type="button" variant="outline" disabled={busy} onClick={() => void act(false)}>
            {busy ? (fa ? "در حال بررسی…" : "Checking…") : (fa ? "بررسی دوبارهٔ وضعیت" : "Check status again")}
          </VendoraButton>}
        </div>}
    </section>
  );
}
