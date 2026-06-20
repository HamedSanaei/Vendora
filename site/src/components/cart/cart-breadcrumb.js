"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const CartBreadcrumb = ({title,subtitle}) => {
  const locale = getLocaleFromPathname(usePathname());
  const isFa = locale === "fa";
  const localizedTitle = isFa ? localizeBreadcrumbText(title) : title;
  const localizedSubtitle = isFa ? localizeBreadcrumbText(subtitle) : subtitle;

  return (
    <section className="breadcrumb__area grey-bg p-relative include-bg pt-100 pb-100">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xxl-8 col-xl-8 col-lg-10">
            <div className="breadcrumb__content text-center p-relative z-index-1">
              <h3 className="breadcrumb__title">{localizedTitle}</h3>
              <div className="breadcrumb__list">
                <span>
                  <Link href={withLocalePath("/", locale)}>{isFa ? "خانه" : "Home"}</Link>
                </span>
                <span className="dvdr">
                  <i className="fa-solid fa-circle-small"></i>
                </span>
                <span>{localizedSubtitle}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

function localizeBreadcrumbText(value) {
  const translations = {
    "My Cart": "سبد خرید من",
    Cart: "سبد خرید",
    "My Wishlist": "علاقه‌مندی‌های من",
    Wishlist: "علاقه‌مندی‌ها",
    Checkout: "تسویه حساب",
  };

  return translations[value] || value;
}

export default CartBreadcrumb;
