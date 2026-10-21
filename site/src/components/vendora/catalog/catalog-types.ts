/** Short-lived server confirmation that a stocked dollar product matches the valid internal rate. */
export interface ProductPriceFreshness {
  verifiedAtUtc: string;
  expiresAtUtc: string;
}

/** A resolved, ordered specification returned only on public product detail requests. */
export interface ProductSpecification {
  catalogAttributeId?: string | null;
  name: string;
  values: string[];
  isVisible: boolean;
  sortOrder: number;
}

/** Product shape returned by the current storefront API. */
export interface StoreProduct {
  slug?: string;
  galleryAlts?: string[];
  breadcrumbs?: Array<{id:string;name:string;slug:string}>;
  _id: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  priceFreshness?: ProductPriceFreshness | null;
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
  colorNames?: string[];
  attributes?: ProductSpecification[];
  tags?: string[];
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
}

/** Display-safe view of an API product shared by cards and details. */
export interface CatalogProductModel {
  slug: string;
  galleryAlts: string[];
  breadcrumbs: Array<{id:string;name:string;slug:string}>;
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  priceFreshness?: ProductPriceFreshness | null;
  image: string;
  gallery: string[];
  price: number;
  oldPrice?: number;
  stock: number;
  sku: string;
  category: string;
  brand: string;
  colors: string[];
  colorNames: string[];
  attributes: ProductSpecification[];
  tags: string[];
  rating: number;
  ratingCount: number;
  reviewCount: number;
  source: StoreProduct;
}

/** Converts the permissive API DTO into the stable catalog view model. */
export function toCatalogProduct(product: StoreProduct): CatalogProductModel {
  // Keep detail-only articles and specifications out of localStorage cart/wishlist snapshots.
  const { descriptionHtml, attributes, ...source } = product;
  const price = Number(product.originalPrice) || 0;
  const discount = Number(product.discount) || 0;
  const gallery = Array.from(new Set([product.image, ...(product.relatedImages ?? [])].filter((value): value is string => Boolean(value))));

  return {
    id: product._id,
    slug: product.slug || product.sku || product._id,
    galleryAlts: product.galleryAlts ?? [],
    breadcrumbs: product.breadcrumbs ?? [],
    title: product.title,
    description: product.description ?? "",
    descriptionHtml: descriptionHtml ?? "",
    priceFreshness: product.priceFreshness,
    image: product.image ?? "",
    gallery,
    price: discount > 0 ? Math.round(price * (1 - discount / 100)) : price,
    oldPrice: discount > 0 ? price : undefined,
    stock: product.quantity ?? 0,
    sku: product.sku ?? product._id,
    category: product.category?.name ?? product.parent ?? product.tags?.[0] ?? "Vendora",
    brand: product.brand?.name ?? "Vendora Studio",
    colors: product.colors ?? [],
    colorNames: product.colorNames ?? product.colors ?? [],
    attributes: (attributes ?? []).filter(row => row.isVisible).sort((a, b) => a.sortOrder - b.sortOrder),
    tags: product.tags ?? [],
    rating: Math.min(5, Math.max(0, Number(product.rating) || 0)),
    ratingCount: Math.max(0, Math.trunc(Number(product.ratingCount) || 0)),
    reviewCount: Math.max(0, Math.trunc(Number(product.reviewCount) || 0)),
    source,
  };
}

/** Accepts real uploaded or bag-specific media and rejects unrelated legacy template imagery. */
export function isVendoraProductImage(source: string): boolean {
  return source.includes("/uploads/") || source.includes("images.unsplash.com") || source.startsWith("/assets/img/vendora/");
}
