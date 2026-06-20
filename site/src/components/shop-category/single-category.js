import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import {
  buildLocalizedShopPath,
  getLocaleFromPathname,
  toTemplateSlug,
} from "@lib/locale-path";

const categoryFallbackImage = "/assets/img/banner/banner-1.jpg";

function getSafeCategoryImage(src) {
  if (!src || typeof src !== "string") {
    return categoryFallbackImage;
  }

  if (src.includes("images.unsplash.com")) {
    return categoryFallbackImage;
  }

  return src;
}

const SingleCategory = ({ item }) => {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const categoryLabel = item.title || item.name || item.parent || item.slug || "category";
  const categorySlug = item.slug || item.children || categoryLabel;
  const categoryPath = buildLocalizedShopPath(locale, {
    Category: toTemplateSlug(categorySlug),
  });

  return (
    <div className="product__category-item mb-20 text-center">
      <div className="product__category-thumb w-img">
        <a
          onClick={() => router.push(categoryPath)}
          style={{ cursor: "pointer" }}
        >
          <Image
            src={getSafeCategoryImage(item.img)}
            alt={categoryLabel}
            width={272}
            height={181}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </a>
      </div>
      <div className="product__category-content">
        <h3 className="product__category-title">
          <a
            onClick={() => router.push(categoryPath)}
            style={{ cursor: "pointer" }}
          >
            {categoryLabel}
          </a>
        </h3>
      </div>
    </div>
  );
};

export default SingleCategory;
