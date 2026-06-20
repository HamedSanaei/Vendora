"use client";
import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildLocalizedShopPath, getLocaleFromPathname } from "@lib/locale-path";

const presets = [
  { min: 0, max: 500000 },
  { min: 500000, max: 1500000 },
  { min: 1500000, max: 3000000 },
  { min: 3000000, max: undefined },
];

const ShopPrice = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const [minPrice, setMinPrice] = useState(searchParams.get("priceMin") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("priceMax") ?? "");

  function applyPrice(nextMin = minPrice, nextMax = maxPrice) {
    router.push(
      buildLocalizedShopPath(locale, {
        priceMin: normalizeDigits(nextMin) || undefined,
        priceMax: normalizeDigits(nextMax) || undefined,
      })
    );
  }

  return (
    <div className="accordion-item">
      <h2 className="accordion-header" id="price__widget">
        <button
          className="accordion-button"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#price_widget_collapse"
          aria-expanded="true"
          aria-controls="price_widget_collapse"
        >
          {isFa ? "محدوده قیمت" : "Price range"}
        </button>
      </h2>
      <div
        id="price_widget_collapse"
        className="accordion-collapse collapse show"
        aria-labelledby="price__widget"
        data-bs-parent="#shop_price"
      >
        <div className="accordion-body">
          <div className="shop-price-range">
            <label>
              {isFa ? "از" : "From"}
              <input
                inputMode="numeric"
                value={formatInput(minPrice, locale)}
                onChange={(event) => setMinPrice(normalizeDigits(event.target.value))}
                onBlur={() => applyPrice()}
                placeholder={isFa ? "کمترین" : "Min"}
              />
            </label>
            <label>
              {isFa ? "تا" : "To"}
              <input
                inputMode="numeric"
                value={formatInput(maxPrice, locale)}
                onChange={(event) => setMaxPrice(normalizeDigits(event.target.value))}
                onBlur={() => applyPrice()}
                placeholder={isFa ? "بیشترین" : "Max"}
              />
            </label>
            <small>{isFa ? "تومان" : "Toman"}</small>
            <div className="shop-price-presets">
              {presets.map((preset) => (
                <button
                  key={`${preset.min}-${preset.max ?? "plus"}`}
                  type="button"
                  onClick={() => {
                    const nextMin = String(preset.min || "");
                    const nextMax = preset.max ? String(preset.max) : "";
                    setMinPrice(nextMin);
                    setMaxPrice(nextMax);
                    applyPrice(nextMin, nextMax);
                  }}
                >
                  {formatPreset(preset, locale)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function normalizeDigits(value) {
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[^\d]/g, "");
}

function formatInput(value, locale) {
  const normalized = normalizeDigits(value);
  return normalized
    ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(normalized))
    : "";
}

function formatPreset(preset, locale) {
  const unit = locale === "fa" ? "تومان" : "Toman";
  const from = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(preset.min);
  if (!preset.max) {
    return locale === "fa" ? `از ${from} ${unit}` : `${from}+ ${unit}`;
  }

  const to = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(preset.max);
  return locale === "fa" ? `${from} تا ${to}` : `${from}-${to}`;
}

export default ShopPrice;
