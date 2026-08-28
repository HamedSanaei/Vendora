'use client';
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
// internal
import EmptyCart from "@components/common/sidebar/cart-sidebar/empty-cart";
import SingleWishlist from "./single-wishlist";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const WishlistArea = () => {
  const { wishlist } = useSelector((state) => state.wishlist);
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
    goToCart: isFa ? "رفتن به سبد خرید" : "Go to Cart",
  };

  return (
    <section className="cart-area pt-100 pb-100">
      <div className="container">
        <div className="row">
          <div className="col-12">
            {wishlist.length > 0 && (
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
                      {wishlist.map((item, i) => (
                        <SingleWishlist key={i} item={item} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row">
                  <div className="col-12">
                    <div className="tp-wishlist-btn mt-50">
                      <Link href={withLocalePath("/cart", locale)} className="tp-btn tp-btn-black">
                        {copy.goToCart}
                      </Link>
                    </div>
                  </div>
                </div>
              </form>
            )}
            {wishlist.length === 0 && <EmptyCart />}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WishlistArea;
