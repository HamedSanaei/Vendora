import React from "react";

const OrderSingleCartItem = ({ title, quantity, price, locale = "en" }) => {
  const isFa = locale === "fa";
  const formatPrice = (value) =>
    new Intl.NumberFormat(isFa ? "fa-IR" : "en-US").format(Number(value || 0)) + (isFa ? " تومان" : " Toman");

  return (
    <tr className="cart_item">
      <td className="product-name">
        {title} <strong className="product-quantity"> × {quantity}</strong>
      </td>
      <td className="product-total text-end">
        <span className="amount">{formatPrice(price)}</span>
      </td>
    </tr>
  );
};

export default OrderSingleCartItem;
