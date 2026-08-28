import Image from "next/image";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// internal
import empty_img from "@assets/img/product/cartmini/empty-cart.png";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const EmptyCart = ({ search_prd = false }) => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const isWishlist = pathname.includes("/wishlist");
  const message = search_prd
    ? isFa
      ? "متأسفانه این محصول پیدا نشد"
      : "Sorry, we can not find this product"
    : isWishlist
      ? isFa
        ? "لیست علاقه‌مندی‌های شما خالی است"
        : "Your wishlist is empty"
      : isFa
        ? "سبد خرید شما خالی است"
        : "Your cart is empty";
  const buttonText = isFa ? "رفتن به فروشگاه" : "Go to Shop";

  return (
    <div className="cartmini__empty text-center">
      <Image src={empty_img} alt={isFa ? "سبد خالی" : "Empty cart"} />
      <p>{message}</p>
      {!search_prd && (
        <Link href={withLocalePath("/shop", locale)} className="tp-btn">
          {buttonText}
        </Link>
      )}
    </div>
  );
};

export default EmptyCart;
