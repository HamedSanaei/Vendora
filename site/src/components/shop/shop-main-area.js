'use client';
import { useState } from "react";
// internal
import Wrapper from "@layout/wrapper";
import Header from "@layout/header";
import ShopCta from "@components/cta";
import Footer from "@layout/footer";
import ShopBreadcrumb from "@components/common/breadcrumb/shop-breadcrumb";
import ShopArea from "@components/shop/shop-area";
import ErrorMessage from "@components/error-message/error";
import { useGetShowingProductsQuery } from "src/redux/features/productApi";
import { useGetCategoriesQuery } from "src/redux/features/categoryApi";
import ShopLoader from "@components/loader/shop-loader";
import { toTemplateSlug } from "@lib/locale-path";

export default function ShopMainArea({ Category, category, brand, priceMin, max, priceMax, color }) {
  const { data: products, isError, isLoading } = useGetShowingProductsQuery();
  const { data: categories } = useGetCategoriesQuery();
  const [shortValue,setShortValue] = useState("");

  // selectShortHandler
  const selectShortHandler = (e) => {
    setShortValue(e.value);
  };

  // decide what to render
  let content = null;
  if (isLoading) {
    content = <ShopLoader loading={isLoading} />;
  }

  if (!isLoading && isError) {
    content = <ErrorMessage message="There was an error" />;
  }

  if (!isLoading && !isError && products?.products?.length === 0) {
    content = <ErrorMessage message="No products found!" />;
  }

  if (!isLoading && !isError && products?.products?.length > 0) {
    let all_products = products.products;
    let product_items = all_products;

    if (Category) {
      const categorySlugs = getCategoryAndDescendantSlugs(categories?.categories || [], Category);
      const selectedCategorySlugs = new Set(categorySlugs);
      product_items = product_items.filter(
        (product) => {
          const productParentSlug = toTemplateSlug(product.parent);
          const productCategorySlugs = getProductCategorySlugs(product);

          return (
            productParentSlug === Category ||
            productCategorySlugs.some((productCategorySlug) => selectedCategorySlugs.has(productCategorySlug))
          );
        }
      );
    }
    if (category) {
      product_items = product_items.filter(
        (product) => getProductCategorySlugs(product).includes(category)
      );
    }
    if (brand) {
      product_items = product_items.filter(
        (product) =>
          product.brand.name.toLowerCase().replace("&", "").split(" ").join("-") ===
          brand
      );
    }
    if (color) {
      product_items = product_items.filter((product) =>
        product.colors.includes(color)
      );
    }
    if (priceMin || max || priceMax) {
      product_items = product_items.filter((product) => {
        const price = Number(product.originalPrice);
        const minPrice = Number(priceMin);
        const maxPrice = Number(max);
        if (!priceMax && priceMin && max) {
          return price >= minPrice && price <= maxPrice;
        }
        if (priceMax) {
          return price >= priceMax;
        }
      });
    }
    // selectShortHandler
    if (shortValue === "Short Filtering") {
      product_items = all_products
    }
    // Latest Product
    if (shortValue === "Latest Product") {
      product_items = all_products.filter(
        (product) => product.itemInfo === "latest-product"
      );
    }
    // Price low to high
    if (shortValue === "Price low to high") {
      product_items = all_products
        .slice()
        .sort((a, b) => Number(a.originalPrice) - Number(b.originalPrice));
    }
    // Price high to low
    if (shortValue === "Price high to low") {
      product_items = all_products
        .slice()
        .sort((a, b) => Number(b.originalPrice) - Number(a.originalPrice));
    }


    content = (
      <ShopArea
        products={product_items}
        all_products={all_products}
        shortHandler={selectShortHandler}
      />
    );
  }

  return (
    <Wrapper>
      <Header style_2={true} />
      <ShopBreadcrumb />
      {content}
      <ShopCta />
      <Footer />
    </Wrapper>
  );
}

function getCategoryAndDescendantSlugs(categories, selectedSlug) {
  const selectedCategory = findCategoryBySlug(categories, selectedSlug);

  if (!selectedCategory) {
    return [selectedSlug];
  }

  return collectCategorySlugs(selectedCategory);
}

function findCategoryBySlug(categories, selectedSlug) {
  for (const category of categories) {
    const categorySlug = getCategorySlug(category);

    if (categorySlug === selectedSlug) {
      return category;
    }

    const childMatch = findCategoryBySlug(getCategoryChildren(category), selectedSlug);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function collectCategorySlugs(category) {
  return [
    getCategorySlug(category),
    ...getCategoryChildren(category).flatMap((child) =>
      typeof child === "string" ? [toTemplateSlug(child)] : collectCategorySlugs(child)
    ),
  ].filter(Boolean);
}

function getCategoryChildren(category) {
  return Array.isArray(category?.children) ? category.children : [];
}

function getCategorySlug(category) {
  if (typeof category === "string") {
    return toTemplateSlug(category);
  }

  return toTemplateSlug(category?.slug || category?.title || category?.name || category?.parent);
}

function getProductCategorySlugs(product) {
  const slugs = [
    ...(product.categorySlugs || []),
    ...(product.categories || []).map((category) => category.slug),
    product.children,
    product.category?.slug,
  ];

  return [...new Set(slugs.map((slug) => toTemplateSlug(slug || "")).filter(Boolean))];
}
