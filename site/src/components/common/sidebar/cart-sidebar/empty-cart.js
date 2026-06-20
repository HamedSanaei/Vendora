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

  return (
    <div className="cartmini__empty text-center">
      <Image src={empty_img} alt="empty img" />
      <p>{search_prd ? `Sorry,😥 we can not find this product` : `Your Cart is empty`}</p>
      {!search_prd && (
        <Link href={withLocalePath("/shop", locale)} className="tp-btn">
          Go to Shop
        </Link>
      )}
    </div>
  );
};

export default EmptyCart;
