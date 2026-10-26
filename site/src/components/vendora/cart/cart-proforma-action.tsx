"use client";
import { shippingCartFingerprint } from "@/lib/shipping-client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { VendoraButton } from "@/components/vendora/ui/button";
import { getCartUnitPrice, type CartLine } from "./cart-model";
import { commercialError, documentCopy, documentToken, issueProforma } from "@/lib/accounting-documents";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { readCustomerAccount, completeProfileHref, profileErrorCode } from '@/lib/auth/customer-profile';

/** Extends the existing cart summary with the approved proforma action, preserving cart/auth/shipping state. */
export function CartProformaAction({ locale }: { locale: Locale }) {
  const router = useRouter(), t = documentCopy[locale], guard = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const items = useSelector((state: { cart: { cart_products: CartLine[] } }) => state.cart.cart_products);
  const shipping = useSelector((state: { order: { shipping_info?: { shippingMethodId?: string; shippingQuoteId?: string; shippingAddressId?: string; shippingQuoteExpiresAtUtc?: string; shippingCartFingerprint?: string } } }) => state.order.shipping_info);
  const coupon = useSelector((state: { coupon: { coupon_info?: { couponCode?: string } } }) => state.coupon.coupon_info);
  /** Guests return to their preserved cart; issuance itself requires a separate explicit click after sign-in. */
  async function issue() {
    if (guard.current) return;
    const token = documentToken();
    if (!token) { router.push(`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(withLocalePath("/cart", locale))}`); return; }
    guard.current = true; setBusy(true); setError("");
    try {
      if (!(await readCustomerAccount()).completion?.isComplete) { router.push(completeProfileHref(locale, withLocalePath('/cart', locale))); return; }
      const currentQuote = shipping?.shippingCartFingerprint === shippingCartFingerprint(items, coupon?.couponCode) && Date.parse(shipping?.shippingQuoteExpiresAtUtc ?? '') > Date.now();
      const method = shipping?.shippingMethodId === 'freight' && items.reduce((sum, item) => sum + item.orderQuantity, 0) <= 10 ? undefined : shipping?.shippingMethodId;
      const id = await issueProforma({ items: items.map(item => ({ productId: item._id, quantity: item.orderQuantity, expectedUnitPrice: getCartUnitPrice(item) })), shippingMethod: method, shippingQuoteId: currentQuote ? shipping?.shippingQuoteId : undefined, addressId: currentQuote ? shipping?.shippingAddressId : undefined, couponCode: coupon?.couponCode }, token);
      router.push(`${withLocalePath("/account/proformas", locale)}?issued=${id}`);
    } catch (failure) {
      if (profileErrorCode(failure) === 'PROFILE_INCOMPLETE') router.push(completeProfileHref(locale, withLocalePath('/cart', locale)));
      else setError(commercialError(failure, locale === "fa"));
    }
    finally { guard.current = false; setBusy(false); }
  }
  return <div className="mt-3"><VendoraButton type="button" variant="outline" className="min-h-12 w-full" disabled={busy || !items.length} onClick={issue}>{busy ? t.issuing : t.issue}</VendoraButton>{error && <p role="alert" className="mt-3 text-sm leading-7 text-vd-danger">{error}</p>}</div>;
}
