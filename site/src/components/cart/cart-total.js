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

  return (
    <div className="cart-page-total">
      <h2>Cart totals</h2>
      <ul className="mb-20">
        <li>
          Subtotal <span>{formatToman(total, locale)}</span>
        </li>
        <li>
          Total <span>{formatToman(total, locale)}</span>
        </li>
      </ul>
      <Link href={withLocalePath("/checkout", locale)} className="tp-btn cursor-pointer">
        Proceed to checkout
      </Link>
    </div>
  );
};

export default CartTotal;
