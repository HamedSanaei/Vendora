import { createApi } from "@reduxjs/toolkit/query/react";
import { getProductById, getRelatedProducts, mockStoreData } from "src/data/mock-store-data";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";
const fallbackProductImage = "/assets/img/product/product-1.jpg";
const fallbackCategoryImage = "/assets/img/banner/banner-1.jpg";

async function catalogFetch(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalog API failed with ${response.status}`);
  }

  return response.json();
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) {
    return fallbackProductImage;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return `${apiBaseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function mapCatalogProduct(product) {
  const images = [...(product.images || [])].sort((a, b) => a.sortOrder - b.sortOrder).map((image) => resolveImageUrl(image.imageUrl));
  const primaryImage = resolveImageUrl(product.primaryImageUrl || images[0]);
  const categories = product.categories || [];
  const primaryCategory = categories[0] || null;
  const categoryName = primaryCategory?.name || product.categoryName || "Bags";
  const categorySlug = primaryCategory?.slug || product.categorySlug || "bags";
  const categoryId = primaryCategory?.id || product.categoryId || "bags";
  const categorySlugs = categories.length > 0 ? categories.map((category) => category.slug) : [categorySlug];

  return {
    _id: product.id,
    id: product.id,
    sku: product.slug,
    title: product.title,
    slug: product.slug,
    parent: categoryName,
    children: categorySlug,
    categorySlugs,
    tags: [categoryName, product.brandName, ...categories.map((category) => category.name), ...(product.colors || []).map((color) => color.name)].filter(Boolean),
    image: primaryImage,
    originalPrice: Number(product.price),
    price: Number(product.price),
    discount: 0,
    relatedImages: images.length ? images : [primaryImage],
    description: product.description || "",
    brand: {
      name: product.brandName || "Vendora",
      id: product.brandId || "vendora",
      slug: product.brandSlug || "vendora",
    },
    category: {
      name: categoryName,
      id: categoryId,
      slug: categorySlug,
    },
    categories,
    unit: `${product.stockQuantity} pcs`,
    quantity: product.stockQuantity,
    colors: (product.colors || []).map((color) => color.slug),
    type: "Bag",
    itemInfo: "latest",
    status: "active",
  };
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

  try {
    if (normalizedUrl === "api/products/show") {
      const products = await catalogFetch("/api/catalog/products");
      return { data: { success: true, products: products.map(mapCatalogProduct) } };
    }

    if (normalizedUrl === "api/category/show") {
      const categories = await catalogFetch("/api/catalog/categories/tree");
      return { data: { success: true, categories: flattenCategories(categories) } };
    }

    if (normalizedUrl.startsWith("api/products/") && !normalizedUrl.startsWith("api/products/relatedProduct")) {
      const products = await catalogFetch("/api/catalog/products");
      const productId = normalizedUrl.replace("api/products/", "");
      const mapped = products.map(mapCatalogProduct);
      return { data: mapped.find((product) => product._id === productId || product.slug === productId) ?? mapped[0] };
    }
  } catch (error) {
    return mockBaseQuery(args);
  }

  return mockBaseQuery(args);
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: hybridBaseQuery,
  tagTypes: ["Category", "Products", "Discount", "Coupon", "Product", "RelatedProducts", "Address"],
  endpoints: (builder) => ({}),
});
