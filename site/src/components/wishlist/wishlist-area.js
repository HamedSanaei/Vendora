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
                        Continue Shopping <i className="fal fa-reply"></i>
                      </Link>
                    </p>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="product-thumbnail">Images</th>
                        <th className="cart-product-name">Product</th>
                        <th className="product-price">Unit Price</th>
                        <th className="product-quantity">Quantity</th>
                        <th className="product-subtotal">Total</th>
                        <th className="product-remove">Remove</th>
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
                        Go to Cart
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
