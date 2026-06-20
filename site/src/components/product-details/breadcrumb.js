'use client';
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Home from "@svg/home";
// internal
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const ProductDetailsBreadcrumb = ({title}) => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  return (
    <section className="breadcrumb__area breadcrumb__style-9 pt-75 include-bg">
      <div className="container">
        <div className="row">
          <div className="col-xxl-7">
            <div className="breadcrumb__content p-relative z-index-1">
              <div className="breadcrumb__list has-icon">
                <span className="breadcrumb-icon">
                  <Home />
                </span>
                <span>
                  <Link href={withLocalePath("/", locale)}>{isFa ? "خانه" : "Home"}</Link>
                </span>
                <span className="dvdr">
                  <i className={`fa-regular ${isFa ? "fa-angle-left" : "fa-angle-right"}`}></i>
                </span>
                <span>
                  <Link href={withLocalePath("/shop", locale)}>{isFa ? "محصولات" : "Products"}</Link>
                </span>
                <span className="dvdr">
                  <i className={`fa-regular ${isFa ? "fa-angle-left" : "fa-angle-right"}`}></i>
                </span>
                <span>{title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetailsBreadcrumb;
