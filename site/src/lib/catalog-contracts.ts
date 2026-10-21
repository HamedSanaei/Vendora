import type { ProductPriceFreshness, ProductSpecification } from '@/components/vendora/catalog/catalog-types';

export interface SeoFields { title?: string | null; description?: string | null; canonicalUrl?: string | null; index: boolean; follow: boolean; socialTitle?: string | null; socialDescription?: string | null; socialImageUrl?: string | null }
export interface SeoMetadataDto { fields: SeoFields; score?: number | null; analysisVersion?: string | null }
export interface SiteSeoSettings { siteName: string; siteUrl: string; titleTemplate: string; isIndexingEnabled: boolean; defaultDescription?: string | null; logoUrl?: string | null; socialProfiles?: string | null }
export interface CategoryLink { id: string; name: string; slug: string }
export interface CatalogCategory extends CategoryLink { parentCategoryId: string | null; children: CatalogCategory[] }
export interface CategoryDetail extends CategoryLink { descriptionHtml?: string | null; description?: string | null; imageUrl?: string | null; seo?: SeoMetadataDto | null; breadcrumbs: CategoryLink[]; children: CategoryLink[] }
export interface CatalogProductDto {
  rating?: number; ratingCount?: number; reviewCount?: number;
  id: string; title: string; slug: string; description?: string | null; descriptionHtml?: string | null; price: number; stockQuantity: number;
  categoryId?: string | null; categoryName?: string | null; categorySlug?: string | null;
  brandId?: string | null; brandName?: string | null; brandSlug?: string | null; primaryImageUrl?: string | null;
  images: Array<{ id: string; imageUrl: string; altText?: string | null; isPrimary: boolean; sortOrder: number }>;
  categories: Array<CategoryLink & {parentCategoryId?: string | null}>;
  colors: Array<{id: string; name: string; slug: string; hexCode?: string | null}>;
  priceFreshness?: ProductPriceFreshness | null; attributes?: ProductSpecification[] | null; seo?: SeoMetadataDto | null; breadcrumbs?: CategoryLink[];
}
export interface CatalogSearchResult { products: CatalogProductDto[]; total: number; page: number; pageSize: number }
export type CatalogSearchParams = Record<string, string | string[] | undefined>;
