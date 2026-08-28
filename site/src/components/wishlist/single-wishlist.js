import Image from "next/image";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
// internal
import { Minus, Plus } from "@svg/index";
import { remove_wishlist_product } from "src/redux/features/wishlist-slice";
import {
  add_cart_product,
  quantityDecrement,
} from "src/redux/features/cartSlice";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import { getSafeImageProps } from "@lib/image-source";
import { formatToman } from "@lib/format-money";

const SingleWishlist = ({ item }) => {
  const { _id, image, title, originalPrice } = item || {};
  const { cart_products } = useSelector((state) => state.cart);
  const isAddToCart = cart_products.find((item) => item._id === _id);
  const dispatch = useDispatch();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const detailsPath = withLocalePath(`/product-details/${_id}`, locale);
  const orderQuantity = isAddToCart?.orderQuantity || 0;
  const removeLabel = locale === "fa" ? "حذف از علاقه‌مندی‌ها" : "Remove from wishlist";
  const imageAlt = locale === "fa" ? `تصویر ${title || "محصول"}` : `${title || "Product"} image`;

  // handle add product
  const handleAddProduct = (prd) => {
    dispatch(add_cart_product(prd));
  };

  // handle decrement product
  const handleDecrement = (prd) => {
    dispatch(quantityDecrement(prd));
  };

  // handleRemovePrd
  const handleRemovePrd = (prd) => {
    dispatch(remove_wishlist_product(prd));
  };

  // handleChange
  const handleChange = (e) => {};
  return (
    <tr>
      <td className="product-thumbnail">
        <Link href={detailsPath}>
          <Image {...getSafeImageProps(image)} alt={imageAlt} width={125} height={125} />
        </Link>
      </td>
      <td className="product-name">
        <Link href={detailsPath}>{title}</Link>
      </td>
      <td className="product-price">
        <span className="amount">{formatToman(originalPrice, locale)}</span>
      </td>
      <td className="product-quantity">
        <div className="tp-product-quantity mt-10 mb-10">
          <span className="tp-cart-minus" onClick={() => handleDecrement(item)}>
            <Minus />
          </span>
          <input
            className="tp-cart-input"
            type="text"
            value={orderQuantity}
            onChange={handleChange}
          />
          <span className="tp-cart-plus" onClick={() => handleAddProduct(item)}>
            <Plus />
          </span>
        </div>
      </td>
      <td className="product-subtotal">
        <span className="amount">{formatToman(originalPrice * orderQuantity, locale)}</span>
      </td>
      <td className="product-remove">
        <button type="submit" onClick={() => handleRemovePrd(item)} aria-label={removeLabel}>
          <i className="fa fa-times"></i>
        </button>
      </td>
    </tr>
  );
};

export default SingleWishlist;
