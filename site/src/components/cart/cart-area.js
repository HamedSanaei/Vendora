'use client';
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
// internal
import CartTotal from "./cart-total";
import SingleCartItem from "./single-cart";
import EmptyCart from "@components/common/sidebar/cart-sidebar/empty-cart";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

// cart items

const CartArea = () => {
  const { cart_products } = useSelector((state) => state.cart);
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const copy = {
    continueShopping: isFa ? "ادامه خرید" : "Continue Shopping",
    image: isFa ? "تصویر" : "Image",
    product: isFa ? "محصول" : "Product",
    unitPrice: isFa ? "قیمت واحد" : "Unit Price",
    quantity: isFa ? "تعداد" : "Quantity",
    total: isFa ? "جمع" : "Total",
    remove: isFa ? "حذف" : "Remove",
  };

  return (
    <section className="cart-area pt-100 pb-100">
      <div className="container">
        <div className="row">
          <div className="col-12">
            {cart_products.length > 0 && (
              <form onSubmit={e => e.preventDefault()}>
                <div className="table-content table-responsive">
                  <div className="tp-continue-shopping">
                    <p>
                      <Link href={withLocalePath("/shop", locale)}>
                        {copy.continueShopping} <i className="fal fa-reply"></i>
                      </Link>
                    </p>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="product-thumbnail">{copy.image}</th>
                        <th className="cart-product-name">{copy.product}</th>
                        <th className="product-price">{copy.unitPrice}</th>
                        <th className="product-quantity">{copy.quantity}</th>
                        <th className="product-subtotal">{copy.total}</th>
                        <th className="product-remove">{copy.remove}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart_products.map((item, i) => (
                        <SingleCartItem key={i} item={item} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row justify-content-end">
                  <div className="col-md-5 mr-auto">
                    {/* cart total */}
                    <CartTotal />
                    {/* cart total */}
                  </div>
                </div>
              </form>
            )}
            {cart_products.length === 0 && <EmptyCart />}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CartArea;
