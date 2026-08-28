import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { buildLocalizedShopPath, getLocaleFromPathname } from "@lib/locale-path";
import { useGetColorsQuery } from "src/redux/features/colorApi";

const ShopColor = ({ all_products }) => {
  const [isChecked, setIsChecked] = useState("");
  const { data: colorData } = useGetColorsQuery();
  const searchParams = useSearchParams();
  const color = searchParams.get("color");
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const productColors = [...new Set(all_products.flatMap((prd) => prd.colors || []))]
    .map((slug) => ({ id: slug, name: slug, slug, hexCode: null }));
  const colors = colorData?.colors?.length ? colorData.colors : productColors;

  // handle brand
  const handleColors = (value) => {
    if (isChecked === value) {
      setIsChecked("");
      router.push(buildLocalizedShopPath(locale));
    } else {
      setIsChecked(value);
      router.push(buildLocalizedShopPath(locale, { color: value }));
    }
  };

  return (
    <div className="accordion-item">
      <h2 className="accordion-header" id="color__widget">
        <button
          className="accordion-button"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#color_widget_collapse"
          aria-expanded="true"
          aria-controls="color_widget_collapse"
        >
          {isFa ? "رنگ" : "Color"}
        </button>
      </h2>
      <div
        id="color_widget_collapse"
        className="accordion-collapse collapse show"
        aria-labelledby="color__widget"
        data-bs-parent="#shop_color"
      >
        <div className="accordion-body">
          <div
            className="shop__widget-list"
            style={{ height: "180px", overflowY: "auto" }}
          >
            {colors.map((clr) => (
              <div key={clr.id ?? clr.slug} className={`shop__widget-list-item-2 has-${clr.slug}`}>
                <input
                  type="checkbox"
                  id={`c-${clr.slug}`}
                  checked={
                    color === clr.slug ? "checked" : false
                  }
                  readOnly
                />
                <label
                  onClick={() => handleColors(clr.slug)}
                  htmlFor={`c-${clr.slug}`}
                  className="text-capitalize"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor: clr.hexCode || "#d1d5db",
                      border: "1px solid #d1d5db",
                      borderRadius: "999px",
                      display: "inline-block",
                      height: "14px",
                      marginInlineEnd: "8px",
                      verticalAlign: "middle",
                      width: "14px",
                    }}
                  />
                  {clr.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopColor;
