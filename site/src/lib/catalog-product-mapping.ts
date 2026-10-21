import type { CatalogProductDto } from './catalog-contracts';
import { resolveApiImageUrl } from './http';

/** One public API adapter for server rendering and the existing Redux catalog endpoints. */
export function mapCatalogProduct(product: CatalogProductDto) {
  const gallery = [...(product.images ?? [])].sort((a,b) => Number(b.isPrimary)-Number(a.isPrimary) || a.sortOrder-b.sortOrder);
  const images = gallery.map(image => resolveApiImageUrl(image.imageUrl));
  const primaryImage = product.primaryImageUrl ? resolveApiImageUrl(product.primaryImageUrl) : images[0] || '/assets/img/product/product-1.jpg';
  const categories = product.categories ?? [];
  const category = categories.find(item => item.id === product.categoryId) ?? categories[0];
  const categoryName = category?.name || product.categoryName || 'Vendora';
  const categorySlug = category?.slug || product.categorySlug || '';
  return {
    _id: product.id, id: product.id, slug: product.slug, sku: product.slug, title: product.title,
    rating: product.rating ?? 0, ratingCount: product.ratingCount ?? 0, reviewCount: product.reviewCount ?? 0,
    parent: categoryName, children: categorySlug, categorySlugs: categories.map(item => item.slug),
    tags: [categoryName, product.brandName, ...categories.map(item => item.name), ...(product.colors ?? []).map(color => color.name)].filter((value): value is string => Boolean(value)),
    image: primaryImage, originalPrice: Number(product.price), price: Number(product.price), discount: 0,
    relatedImages: images.length ? images : [primaryImage], galleryAlts: gallery.map(image => image.altText ?? product.title),
    description: product.description || '', descriptionHtml: product.descriptionHtml || '',
    priceFreshness: product.priceFreshness || null, attributes: product.attributes || [], seo: product.seo, breadcrumbs: product.breadcrumbs ?? [],
    brand: {name:product.brandName || 'Vendora',id:product.brandId || 'vendora',slug:product.brandSlug || 'vendora'},
    category: {name:categoryName,id:category?.id || product.categoryId || '',slug:categorySlug}, categories,
    unit: `${product.stockQuantity} pcs`, quantity:product.stockQuantity,
    colors:(product.colors ?? []).map(color => color.slug), colorNames:(product.colors ?? []).map(color => color.name),
    type:'Bag',itemInfo:'latest',status:'active'
  };
}
