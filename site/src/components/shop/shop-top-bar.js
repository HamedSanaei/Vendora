"use client";
import React from "react";
import { usePathname } from "next/navigation";
// internal
import { Dots, Lists } from "@svg/index";
import NiceSelect from "@ui/NiceSelect";

export function ShowingResult({ show, total }) {
  const locale = useLocale();
  return (
    <div className="shop__result">
      <p>
        {locale === "fa"
          ? `نمایش ۱ تا ${new Intl.NumberFormat("fa-IR").format(show)} از ${new Intl.NumberFormat("fa-IR").format(total)} نتیجه`
          : `Showing 1-${show} of ${total} results`}
      </p>
    </div>
  );
}

export function ShopShortTab({ handleTab }) {
  return (
    <div className="shop__sort-item">
      <div className="shop__sort-tab tp-tab">
        <nav>
          <div className="nav nav-tabs" id="nav-tab" role="tablist">
            <button
              onClick={() => handleTab("grid")}
              className="nav-link active"
              id="nav-grid-tab"
              data-bs-toggle="tab"
              data-bs-target="#nav-grid"
              type="button"
              role="tab"
              aria-controls="nav-grid"
              aria-selected="true"
              tabIndex="-1"
            >
              <Dots />
            </button>
            <button
              onClick={() => handleTab("lists")}
              className="nav-link"
              id="nav-list-tab"
              data-bs-toggle="tab"
              data-bs-target="#nav-list"
              type="button"
              role="tab"
              aria-controls="nav-list"
              aria-selected="false"
              tabIndex="-1"
            >
              <Lists />
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

export function ShopShortSelect({ shortHandler }) {
  const locale = useLocale();
  const options =
    locale === "fa"
      ? [
          { value: "Short Filtering", text: "مرتب‌سازی" },
          { value: "Latest Product", text: "جدیدترین" },
          { value: "Price low to high", text: "ارزان‌ترین" },
          { value: "Price high to low", text: "گران‌ترین" },
        ]
      : [
          { value: "Short Filtering", text: "Short Filtering" },
          { value: "Latest Product", text: "Latest Product" },
          { value: "Price low to high", text: "Price low to high" },
          { value: "Price high to low", text: "Price high to low" },
        ];

  return (
    <div className="shop__sort-item">
      <div className="shop__sort-select">
        <NiceSelect options={options} defaultCurrent={0} onChange={shortHandler} name="Sort by latest" />
      </div>
    </div>
  );
}

function useLocale() {
  const pathname = usePathname();
  return pathname?.startsWith("/fa") ? "fa" : "en";
}
