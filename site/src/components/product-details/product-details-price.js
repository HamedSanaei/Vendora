"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@lib/locale-path";
import { formatToman } from "@lib/format-money";

const ProductDetailsPrice = ({ price, discount }) => {
  const locale = getLocaleFromPathname(usePathname());
  const discountedPrice = Number(price) - (Number(price) * Number(discount)) / 100;

  return (
    <div className="product__details-price">
      {discount > 0 ? (
        <>
          <span className="product__details-ammount old-ammount">{formatToman(price, locale)}</span>
          <span className="product__details-ammount new-ammount">
            {formatToman(discountedPrice, locale)}
          </span>
          <span className="product__details-offer">-{discount}%</span>
        </>
      ) : (
        <>
          <span className="product__details-ammount new-ammount">{formatToman(price, locale)}</span>
        </>
      )}
    </div>
  );
};

export default ProductDetailsPrice;
