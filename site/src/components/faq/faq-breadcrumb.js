"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const FaqBreadcrumb = () => {
  const locale = getLocaleFromPathname(usePathname());
  const isFa = locale === "fa";
  const title = isFa ? "پرسش‌های متداول" : "Frequently Asked Questions";

  return (
    <section className="breadcrumb__area breadcrumb__style-8 p-relative include-bg pt-110 pb-50">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xxl-8 col-xl-8 col-lg-10">
            <div className="breadcrumb__content text-center p-relative z-index-1">
              <h3 className="breadcrumb__title">{title}</h3>
              <div className="breadcrumb__list">
                <span>
                  <Link href={withLocalePath("/", locale)}>{isFa ? "خانه" : "Home"}</Link>
                </span>
                <span className="dvdr">
                  <i className="fa-solid fa-circle-small"></i>
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

export default FaqBreadcrumb;
