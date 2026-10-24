import { createApi } from "@reduxjs/toolkit/query/react";
import { getProductById, getRelatedProducts, mockStoreData } from "src/data/mock-store-data";
import { http, resolveApiImageUrl } from "@/lib/http";
import { mapCatalogProduct } from "@/lib/catalog-product-mapping";

const fallbackProductImage = "/assets/img/product/product-1.jpg";
const fallbackCategoryImage = "/assets/img/banner/banner-1.jpg";

async function catalogFetch(path) {
  return (await http.get(path.replace(/^\/api\//, "/"))).data;
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) {
    return fallbackProductImage;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return resolveApiImageUrl(imageUrl);
}

function flattenCategories(categories, parentName = null) {
  return categories.flatMap((category) => {
    const mapped = {
      _id: category.id,
      id: category.id,
      parent: parentName,
      title: category.name,
      slug: category.slug,
      img: fallbackCategoryImage,
      status: "Show",
      children: flattenCategories(category.children || [], category.name),
    };

    return [mapped];
  });
}

function mapCatalogColor(color) {
  return {
    id: color.id,
    name: color.name,
    slug: color.slug,
    hexCode: color.hexCode || null,
  };
}

function getMockColors() {
  const colorSlugs = [...new Set(mockStoreData.products.flatMap((product) => product.colors || []))];
  return colorSlugs.map((slug) => ({
    id: slug,
    name: slug,
    slug,
    hexCode: null,
  }));
}

const mockBaseQuery = async (args) => {
  const url = typeof args === "string" ? args : args?.url ?? "";
  const normalizedUrl = url.replace(/^\//, "");

  if (normalizedUrl === "api/products/show") {
    return { data: { success: true, products: mockStoreData.products.filter((product) => product.status === "active") } };
  }

  if (normalizedUrl === "api/products/discount") {
    return { data: { success: true, products: mockStoreData.products.filter((product) => Number(product.discount) > 0) } };
  }

  if (normalizedUrl.startsWith("api/products/relatedProduct")) {
    const search = new URLSearchParams(normalizedUrl.split("?")[1] ?? "");
    const tags = search.get("tags")?.split(",").filter(Boolean) ?? [];
    return { data: { status: true, product: getRelatedProducts(tags) } };
  }

  if (normalizedUrl.startsWith("api/products/")) {
    return { data: getProductById(normalizedUrl.replace("api/products/", "")) };
  }

  if (normalizedUrl === "api/category/show") {
    return { data: { success: true, categories: mockStoreData.categories.filter((category) => category.status === "Show") } };
  }

  if (normalizedUrl === "api/catalog/colors") {
    return { data: { success: true, colors: getMockColors() } };
  }

  if (normalizedUrl === "api/coupon") {
    return { data: mockStoreData.coupons };
  }

  if (normalizedUrl.includes("api/user-order")) {
    return { data: { success: true, orders: mockStoreData.orders } };
  }

  if (normalizedUrl.includes("api/user/me")) {
    return { data: mockStoreData.users[0] ?? null };
  }

  return { data: { success: true, data: null } };
};

const hybridBaseQuery = async (args) => {
  const url = typeof args === "string" ? args : args?.url ?? "";
  const normalizedUrl = url.replace(/^\//, "");
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") return mockBaseQuery(args);

  try {
    if (normalizedUrl === "api/products/show" || normalizedUrl === "api/products/discount") {
      const products = await catalogFetch("/api/catalog/products");
      const mapped = products.map(mapCatalogProduct);
      return { data: { success: true, products: normalizedUrl.endsWith("/discount") ? mapped.filter((product) => product.discount > 0) : mapped } };
    }

    if (normalizedUrl === "api/category/show") {
      const categories = await catalogFetch("/api/catalog/categories/tree");
      return { data: { success: true, categories: flattenCategories(categories) } };
    }

    if (normalizedUrl === "api/catalog/colors") {
      const colors = await catalogFetch("/api/catalog/colors");
      return { data: { success: true, colors: colors.map(mapCatalogColor) } };
    }

    if (normalizedUrl.startsWith("api/products/relatedProduct")) {
      const products = (await catalogFetch("/api/catalog/products")).map(mapCatalogProduct);
      const tags = new URLSearchParams(normalizedUrl.split("?")[1] ?? "").get("tags")?.split(",").filter(Boolean) ?? [];
      return { data: { status: true, product: products.filter((product) => tags.length === 0 || product.tags.some((tag) => tags.includes(tag))) } };
    }

    if (normalizedUrl.startsWith("api/products/")) {
      const productId = normalizedUrl.replace("api/products/", "");
      const product = await catalogFetch(`/api/catalog/products/${encodeURIComponent(productId)}`);
      return { data: mapCatalogProduct(product) };
    }
  } catch (error) {
    // Never substitute synthetic product prices when the real catalog is unavailable.
    return { error: { status: error.response?.status ?? "FETCH_ERROR", data: { message: "Catalog prices are temporarily unavailable." } } };
  }

  // Unsupported legacy demo endpoints must not reintroduce synthetic rows when the global switch is off.
  try {
    const policy = await catalogFetch('/api/store-settings/seed-visibility');
    if (!policy.showSeedData) return { error: { status: 501, data: { message: 'Sample data is hidden; this legacy demo endpoint is unavailable.' } } };
  } catch {
    return { error: { status: 'FETCH_ERROR', data: { message: 'Store settings are temporarily unavailable.' } } };
  }
  return mockBaseQuery(args);
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: hybridBaseQuery,
  tagTypes: ["Category", "Products", "Discount", "Coupon", "Product", "RelatedProducts", "Address", "Colors"],
  endpoints: (builder) => ({}),
});
