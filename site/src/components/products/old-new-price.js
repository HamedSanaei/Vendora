"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@lib/locale-path";
import { formatToman } from "@lib/format-money";

const OldNewPrice = ({originalPrice,discount}) => {
  const locale = getLocaleFromPathname(usePathname());
  const discountedPrice = Number(originalPrice) - (Number(originalPrice) * Number(discount)) / 100;

  return (
    <div className="product__price">
      <del className="product__ammount old-price">
        {formatToman(originalPrice, locale)}
      </del>
      <span className="product__ammount new-price">
        {formatToman(discountedPrice, locale)}
      </span>
    </div>
  );
};

export default OldNewPrice;
