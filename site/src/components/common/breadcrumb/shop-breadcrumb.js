"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "@svg/index";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const ShopBreadcrumb = () => {
  const locale = getLocaleFromPathname(usePathname());
  const isFa = locale === "fa";

  return (
    <section className="breadcrumb__area breadcrumb__style-9 pt-13 pb-55 include-bg">
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
                <span>{isFa ? "محصولات" : "Products"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShopBreadcrumb;
