import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
// internal
import { CartTwo, Eye, HeartTwo } from "@svg/index";
import { RatingFull, RatingHalf } from "./rating";
import { useDispatch } from "react-redux";
import { initialOrderQuantity } from "src/redux/features/cartSlice";
import { setProduct } from "src/redux/features/productSlice";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import { formatToman } from "@lib/format-money";
import { getSafeImageProps } from "@lib/image-source";

const SingleListProduct = ({ product }) => {
  const { _id, image, title, price, discount } = product || {};
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const detailsPath = withLocalePath(`/product-details/${_id}`, locale);
  // handle dispatch
  const dispatch = useDispatch();

  // handle quick view
  const handleQuickView = (prd) => {
    dispatch(initialOrderQuantity())
    dispatch(setProduct(prd))
  };

  return (
    <React.Fragment>
      <div className="product__list-item mb-30">
        <div className="row">
          <div className="col-xl-5 col-lg-5">
            <div className="product__thumb product__list-thumb p-relative fix m-img">
              <Link href={detailsPath}>
                <Image
                  {...getSafeImageProps(image)}
                  alt="image"
                  width={335}
                  height={325}
                  style={{
                    width: "335px",
                    height: "325px",
                    objectFit: "cover",
                  }}
                />
              </Link>
              {discount > 0 && (
                <div className="product__badge d-flex flex-column flex-wrap">
                  <span className={`product__badge-item has-new`}>sale</span>
                </div>
              )}
            </div>
          </div>
          <div className="col-xl-7 col-lg-7">
            <div className="product__list-content">
              <div className="product__rating product__rating-2 d-flex">
                <RatingFull />
                <RatingFull />
                <RatingFull />
                <RatingFull />
                <RatingHalf />
              </div>

              <h3 className="product__list-title">
                <Link href={detailsPath}>{title}</Link>
              </h3>
              <div className="product__list-price">
                <span className="product__list-ammount">{formatToman(price, locale)}</span>
              </div>
              <p>
                Shop Harry.com for every day low prices. Free shipping on orders
                $35+ or Pickup In-store and get
              </p>

              <div className="product__list-action d-flex flex-wrap align-items-center">
                <button
                  type="button"
                  className="product-add-cart-btn product-add-cart-btn-2"
                >
                  <CartTwo />
                  Add to Cart
                </button>
                <button
                  type="button"
                  className="product-action-btn product-action-btn-2"
                >
                  <HeartTwo />
                  <span className="product-action-tooltip">
                    Add To Wishlist
                  </span>
                </button>
                <button
                  onClick={() => handleQuickView(product)}
                  type="button"
                  className="product-action-btn"
                >
                  <Eye />
                  <span className="product-action-tooltip">Quick view</span>
                </button>

                <Link href={detailsPath}>
                  <button
                    type="button"
                    className="product-action-btn product-action-btn-2"
                  >
                    <i className="fa-solid fa-link"></i>
                    <span className="product-action-tooltip">
                      Product Details
                    </span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

export default SingleListProduct;
