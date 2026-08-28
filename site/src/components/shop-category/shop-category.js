'use client';
import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Scrollbar } from "swiper";
import { usePathname } from "next/navigation";
// internal
import SingleCategory from "./single-category";
import ErrorMessage from "@components/error-message/error";
import CategoryLoader from "@components/loader/category-loader";
import { useGetCategoriesQuery } from "src/redux/features/categoryApi";
import { getLocaleFromPathname, toTemplateSlug } from "@lib/locale-path";

function normalizeCategoryLabel(value) {
  return toTemplateSlug(value || "");
}

function getCategoryLabel(category) {
  return category?.title || category?.name || category?.parent || category?.slug || "";
}

function findMaterialParent(categories = []) {
  return categories.find((category) => {
    const label = getCategoryLabel(category);
    const slug = category?.slug || label;

    return (
      normalizeCategoryLabel(label) === normalizeCategoryLabel("بر اساس جنس") ||
      normalizeCategoryLabel(slug) === normalizeCategoryLabel("material") ||
      normalizeCategoryLabel(slug) === normalizeCategoryLabel("by-material")
    );
  });
}

function isMaterialCategory(category) {
  const label = getCategoryLabel(category);
  const slug = category?.slug || label;

  return (
    normalizeCategoryLabel(label) === normalizeCategoryLabel("بر اساس جنس") ||
    normalizeCategoryLabel(label) === normalizeCategoryLabel("by material") ||
    normalizeCategoryLabel(slug) === normalizeCategoryLabel("material") ||
    normalizeCategoryLabel(slug) === normalizeCategoryLabel("by-material")
  );
}

function isSameCategory(left, right) {
  if (!left || !right) {
    return false;
  }

  const leftId = left._id || left.id;
  const rightId = right._id || right.id;

  if (leftId && rightId && leftId === rightId) {
    return true;
  }

  return normalizeCategoryLabel(left.slug || getCategoryLabel(left)) === normalizeCategoryLabel(right.slug || getCategoryLabel(right));
}

function isHomepageFeaturedCategory(category) {
  const label = getCategoryLabel(category);
  const slug = category?.slug || label;
  const normalizedValues = [label, slug].map(normalizeCategoryLabel);

  return [
    "دسته‌بندی‌های جذاب برای صفحه اصلی",
    "featured homepage categories",
    "homepage featured categories",
    "featured-homepage-categories",
    "homepage-featured-categories",
  ].some((candidate) => normalizedValues.includes(normalizeCategoryLabel(candidate)));
}

function replaceHomepageFeaturedWithMaterial(category, categories = [], locale) {
  if (!isHomepageFeaturedCategory(category)) {
    return category;
  }

  const materialParent = findMaterialParent(categories);
  const title = locale === "fa" ? "بر اساس جنس" : "By material";

  return {
    ...category,
    _id: materialParent?._id || materialParent?.id || category._id || category.id,
    id: materialParent?.id || category.id,
    title,
    name: title,
    parent: title,
    slug: materialParent?.slug || "by-material",
    img: materialParent?.img || category.img,
    children: materialParent?.children || category.children,
  };
}

function buildHomeCategories(categories = [], locale) {
  const hasFeaturedCategory = categories.some(isHomepageFeaturedCategory);
  const materialParent = findMaterialParent(categories);

  return categories
    .filter((category) => {
      if (!hasFeaturedCategory || !materialParent || isHomepageFeaturedCategory(category)) {
        return true;
      }

      return !(isMaterialCategory(category) || isSameCategory(category, materialParent));
    })
    .map((category) =>
      replaceHomepageFeaturedWithMaterial(category, categories, locale)
    );
}

const ShopCategoryArea = () => {
  const [loop, setLoop] = useState(false);
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  useEffect(() => setLoop(true), []);
  const { data: categories, isLoading, isError } = useGetCategoriesQuery();
  // decide what to render
  let content = null;

  if (isLoading) {
    content = (
      <CategoryLoader loading={isLoading} />
    );
  }

  if (!isLoading && isError) {
    content = <ErrorMessage message="There was an error" />;
  }

  if (!isLoading && !isError && categories?.categories?.length === 0) {
    content = <ErrorMessage message={locale === "fa" ? "دسته‌بندی پیدا نشد!" : "No Category found!"} />;
  }

  if (!isLoading && !isError) {
    const homeCategories = buildHomeCategories(categories?.categories || [], locale);

    content = homeCategories.map((item, i) => (
      <SwiperSlide key={item._id || item.id || item.slug || `${item.title || item.parent || "category"}-${i}`}>
        <SingleCategory item={item} />
      </SwiperSlide>
    ));
  }
  return (
    <section className="product__category pt-100 pb-100">
      <div className="container">
        <div className="row">
          <div className="col-xxl-12">
            <div className="product__category-slider">
              <Swiper
                className="product__category-slider-active swiper-container"
                slidesPerView={4}
                spaceBetween={30}
                loop={loop}
                modules={[Scrollbar]}
                scrollbar={{
                  el: ".tp-scrollbar",
                  clickable: true,
                }}
                breakpoints={{
                  1601: {
                    slidesPerView: 4,
                  },
                  1400: {
                    slidesPerView: 4,
                  },
                  1200: {
                    slidesPerView: 4,
                  },
                  992: {
                    slidesPerView: 3,
                  },
                  768: {
                    slidesPerView: 2,
                  },
                  576: {
                    slidesPerView: 2,
                    spaceBetween: 20,
                  },
                  0: {
                    slidesPerView: 1,
                    spaceBetween: 0,
                  },
                }}
              >
                {content}
              </Swiper>

              <div className="tp-scrollbar"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShopCategoryArea;
