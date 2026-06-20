import React from "react";
import { usePathname, useRouter } from "next/navigation";
// internal
import ShopCategory from "../../shop-filtering/shop-category";
import ShopModel from "../../shop-filtering/shop-model";
import ShopColor from "../../shop-filtering/shop-color";
import ShopPrice from "../../shop-filtering/shop-price";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const ShopSidebar = ({ all_products }) => {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  const handleReset = () => {
    router.push(withLocalePath("/shop", locale));
  };
  return (
    <div className={`shop__sidebar on-left`}>
      <div className="shop__widget tp-accordion">
        <div className="accordion" id="shop_category">
          <ShopCategory />
        </div>
      </div>
      <div className="shop__widget tp-accordion">
        <ShopModel all_products={all_products} />
      </div>
      <div className="shop__widget tp-accordion">
        <div className="accordion" id="shop_color">
          <ShopColor all_products={all_products} />
        </div>
      </div>
      <div className="shop__widget tp-accordion">
        <div className="accordion" id="shop_price">
          <ShopPrice />
        </div>
      </div>
      <div className="shop__widget tp-accordion">
        <div className="accordion">
          <button onClick={handleReset} className="tp-btn w-100">
            {isFa ? "پاک کردن فیلترها" : "Reset Filter"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopSidebar;
