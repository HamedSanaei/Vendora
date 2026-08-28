"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clear_cart, quantityDecrement, quantityIncrement, remove_product } from "@/redux/features/cartSlice";
import { ChevronIcon } from "@/components/vendora/icons";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { CheckoutStageHeader, CheckoutStickyAction } from "@/components/vendora/checkout/checkout-shell";
import { CartItem, CartSummary, CartTrustBar, EmptyCartState } from "./cart-components";
import { getCartTotals, type CartLine } from "./cart-model";

interface CartRootState {
  cart: { cart_products: CartLine[] };
}

/** Full responsive cart page translated from the approved Penpot frames. */
export function VendoraCartPage() {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const t = getDict(locale).cart;
  const dispatch = useDispatch();
  const items = useSelector((state: CartRootState) => state.cart.cart_products);
  const totals = getCartTotals(items);

  /** Confirms the destructive action before removing all persisted cart lines. */
  const handleClearCart = () => {
    if (window.confirm(t.clearConfirm)) dispatch(clear_cart());
  };

  return (
    <main className={`vd-root vd-cart-page pb-28 lg:pb-0 ${locale === "fa" ? "text-right" : "text-left"}`} dir={locale === "fa" ? "rtl" : "ltr"}>
      <div className="vd-container pt-8 md:pt-10">
        <CheckoutStageHeader locale={locale} activeStep="cart" eyebrow={locale === "fa" ? "مرحله اول خرید" : "Checkout step 1"} title={t.title} description={t.subtitle} />

        {items.length === 0 ? (
          <div className="mt-10"><EmptyCartState locale={locale} /></div>
        ) : (
          <>
            <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_364px] lg:gap-[68px]">
              <section className="min-w-0">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div><h2 className="text-xl font-extrabold text-ink">{t.itemCount(formatNumber(totals.itemCount, locale))}</h2></div>
                  <button type="button" onClick={handleClearCart} className="vd-focus hidden rounded-sm text-sm font-bold text-vd-danger hover:underline md:inline-flex">{t.clear}</button>
                </div>
                <div className="space-y-4">
                  {items.map((item) => (
                    <CartItem
                      key={item._id}
                      item={item}
                      locale={locale}
                      onDecrease={() => dispatch(quantityDecrement(item))}
                      onIncrease={() => dispatch(quantityIncrement(item))}
                      onRemove={() => dispatch(remove_product(item))}
                    />
                  ))}
                </div>
                <CartCoupon locale={locale} />
              </section>

              <div>
                <CartSummary locale={locale} subtotal={totals.subtotal} />
                <Link href={withLocalePath("/shop", locale)} className="vd-focus mt-5 flex h-14 items-center justify-center rounded-control border border-jade text-sm font-bold text-jade hover:bg-jade-tint">{t.continueShopping}</Link>
                <button type="button" onClick={handleClearCart} className="vd-focus mt-3 flex h-10 w-full items-center justify-center rounded-control text-sm font-bold text-vd-danger hover:bg-vd-danger-tint md:hidden">{t.clear}</button>
              </div>
            </div>

            <div className="mt-11"><CartTrustBar locale={locale} /></div>
            <p className="mt-6 text-center text-xs leading-6 text-vd-muted lg:hidden">{t.termsNote}</p>

            <CheckoutStickyAction label={t.payable} value={formatPrice(totals.subtotal, locale)} action={<Link href={withLocalePath("/shipping", locale)} className="vd-focus flex h-[60px] min-w-[176px] items-center justify-center rounded-control bg-jade px-5 text-sm font-extrabold text-white hover:bg-jade-dark">{t.checkout}</Link>} />
          </>
        )}
      </div>
    </main>
  );
}

/** Interactive disclosure for the coupon information shown in the Penpot cart. */
function CartCoupon({ locale }: { locale: Locale }) {
  const t = getDict(locale).cart;
  return (
    <details className="group mt-7 overflow-hidden rounded-card border border-vd-line bg-white">
      <summary className="vd-focus flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 marker:content-none">
        <span className="font-extrabold text-ink">{t.couponTitle}</span>
        <span className="flex items-center gap-3 text-xs text-vd-muted"><span className="hidden sm:inline">{t.couponHint}</span><ChevronIcon size={20} className="text-jade transition-transform group-open:rotate-90" /></span>
      </summary>
      <div className="border-t border-vd-line px-5 py-4"><p className="text-sm leading-7 text-vd-muted">{t.couponBody}</p></div>
    </details>
  );
}
