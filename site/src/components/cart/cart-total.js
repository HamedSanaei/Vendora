import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
// internal
import useCartInfo from "@hooks/use-cart-info";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import { formatToman } from "@lib/format-money";

const CartTotal = () => {
  const { total } = useCartInfo();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const copy = {
    title: isFa ? "جمع سبد خرید" : "Cart totals",
    subtotal: isFa ? "جمع جزء" : "Subtotal",
    total: isFa ? "مبلغ نهایی" : "Total",
    checkout: isFa ? "ادامه به پرداخت" : "Proceed to checkout",
  };

  return (
    <div className="cart-page-total">
      <h2>{copy.title}</h2>
      <ul className="mb-20">
        <li>
          {copy.subtotal} <span>{formatToman(total, locale)}</span>
        </li>
        <li>
          {copy.total} <span>{formatToman(total, locale)}</span>
        </li>
      </ul>
      <Link href={withLocalePath("/shipping", locale)} className="tp-btn cursor-pointer">
        {copy.checkout}
      </Link>
    </div>
  );
};

export default CartTotal;
