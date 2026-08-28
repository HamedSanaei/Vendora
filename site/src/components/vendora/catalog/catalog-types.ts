/** Product shape returned by the current storefront API. */
export interface StoreProduct {
  _id: string;
  title: string;
  description?: string;
  image?: string;
  relatedImages?: string[];
  originalPrice: number | string;
  discount?: number;
  quantity?: number;
  sku?: string;
  parent?: string;
  children?: string;
  itemInfo?: string;
  type?: string;
  categorySlugs?: string[];
  categories?: Array<{ name?: string; slug?: string }>;
  category?: { name?: string; slug?: string };
  brand?: { name?: string; slug?: string };
  colors?: string[];
  tags?: string[];
  rating?: number;
  reviewCount?: number;
}

/** Display-safe view of an API product shared by cards and details. */
export interface CatalogProductModel {
  id: string;
  title: string;
  description: string;
  image: string;
  gallery: string[];
  price: number;
  oldPrice?: number;
  stock: number;
  sku: string;
  category: string;
  brand: string;
  colors: string[];
  tags: string[];
  rating: number;
  reviewCount: number;
  source: StoreProduct;
}

/** Converts the permissive API DTO into the stable catalog view model. */
export function toCatalogProduct(product: StoreProduct): CatalogProductModel {
  const price = Number(product.originalPrice) || 0;
  const discount = Number(product.discount) || 0;
  const gallery = Array.from(new Set([product.image, ...(product.relatedImages ?? [])].filter((value): value is string => Boolean(value))));

  return {
    id: product._id,
    title: product.title,
    description: product.description ?? "",
    image: product.image ?? "",
    gallery,
    price: discount > 0 ? Math.round(price * (1 - discount / 100)) : price,
    oldPrice: discount > 0 ? price : undefined,
    stock: product.quantity ?? 0,
    sku: product.sku ?? product._id,
    category: product.category?.name ?? product.parent ?? product.tags?.[0] ?? "Vendora",
    brand: product.brand?.name ?? "Vendora Studio",
    colors: product.colors ?? [],
    tags: product.tags ?? [],
    rating: Math.min(5, Math.max(0, Number(product.rating) || 0)),
    reviewCount: Math.max(0, Math.trunc(Number(product.reviewCount) || 0)),
    source: product,
  };
}

/** Accepts real uploaded or bag-specific media and rejects unrelated legacy template imagery. */
export function isVendoraProductImage(source: string): boolean {
  return source.includes("/uploads/") || source.includes("images.unsplash.com") || source.startsWith("/assets/img/vendora/");
}
