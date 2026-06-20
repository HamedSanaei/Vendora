"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
// internal
import Header from "@layout/header";
import CartBreadcrumb from "@components/cart/cart-breadcrumb";
import Wrapper from "@layout/wrapper";
import CouponArea from "@components/checkout/coupon-area";
import CheckoutArea from "@components/checkout/checkout-area";
import Footer from "@layout/footer";
import ShopCta from "@components/cta";
import useCheckoutSubmit from "@hooks/use-checkout-submit";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

export default function CheckoutMainArea() {
  const checkout_data = useCheckoutSubmit();
  const { cart_products } = useSelector((state) => state.cart);
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  useEffect(() => {
    const isAuthenticate = localStorage.getItem("auth");
    if (!isAuthenticate) {
      router.push(withLocalePath("/login", locale));
    }
  }, [locale, router]);
  return (
    <Wrapper>
      <Header style_2={true} />
      <CartBreadcrumb title={isFa ? "تسویه حساب" : "Checkout"} subtitle={isFa ? "تسویه حساب" : "Checkout"} />
      {cart_products.length === 0 ? (
        <div className="text-center pt-80 pb-80">
          <h3 className="py-2">{isFa ? "سبد خرید شما برای تسویه حساب خالی است" : "No items found in cart to checkout"}</h3>
          <Link href={withLocalePath("/shop", locale)} className="tp-btn">
            {isFa ? "بازگشت به فروشگاه" : "Return to shop"}
          </Link>
        </div>
      ) : (
        <>
          <CouponArea {...checkout_data} />
          <CheckoutArea {...checkout_data} />
        </>
      )}
      <ShopCta />
      <Footer />
    </Wrapper>
  );
}
