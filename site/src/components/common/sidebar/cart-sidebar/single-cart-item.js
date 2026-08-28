import React from "react";
import Image from "next/image";
import { useDispatch } from "react-redux";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { remove_product } from "src/redux/features/cartSlice";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import { getSafeImageProps } from "@lib/image-source";
import { formatToman } from "@lib/format-money";

const SingleCartItem = ({ item }) => {
  const { _id, image, originalPrice, title, orderQuantity, discount } =
    item || {};
  const dispatch = useDispatch();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const detailsPath = withLocalePath(`/product-details/${_id}`, locale);
  const imageAlt = locale === "fa" ? `تصویر ${title || "محصول"}` : `${title || "Product"} image`;
  const removeLabel = locale === "fa" ? "حذف از سبد خرید" : "Remove from cart";
  const discountedPrice = (originalPrice - (originalPrice * discount) / 100) * orderQuantity;

  // handle remove cart
  const handleRemoveProduct = (prd) => {
    dispatch(remove_product(prd));
  };
  return (
    <div className="cartmini__widget-item">
      {image && (
        <div className="cartmini__thumb">
          <Link href={detailsPath}>
            <Image {...getSafeImageProps(image)} alt={imageAlt} width={70} height={90} />
          </Link>
        </div>
      )}
      <div className="cartmini__content">
        <h5>
          <Link href={detailsPath}>{title}</Link>
        </h5>
        <div className="cartmini__price-wrapper">
          {!discount && (
            <span className="cartmini__price">{formatToman(originalPrice, locale)}</span>
          )}
          {discount > 0 && (
            <span className="cartmini__price">{formatToman(discountedPrice, locale)}</span>
          )}
          <span className="cartmini__quantity">x{orderQuantity}</span>
        </div>
      </div>
      <button
        className="cartmini__del"
        onClick={() => handleRemoveProduct(item)}
        aria-label={removeLabel}
      >
        <i className="fal fa-times"></i>
      </button>
    </div>
  );
};

export default SingleCartItem;
