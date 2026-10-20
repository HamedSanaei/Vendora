import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { CatalogPage } from './catalog-page';
import type { CatalogSearchParams } from '@/lib/catalog-contracts';
import { catalogQuery, readCatalogBrands, readCatalogCategory, readCatalogColors, readCatalogSearch, readCategoryTree, readSeoSite, requestLocale } from '@/lib/catalog.server';
import { categoryPath, categorySchema, pageMetadata, structuredJson } from '@/lib/catalog-seo';

/** Server metadata stays aligned with category content and marks faceted combinations as non-indexable. */
export async function catalogMetadata(params: CatalogSearchParams, slug?: string): Promise<Metadata> {
  const [site,locale,category] = await Promise.all([readSeoSite(),requestLocale(),slug ? readCatalogCategory(slug) : undefined]);
  const faceted = Object.keys(params).some(key => !['page','utm_source','utm_medium','utm_campaign'].includes(key));
  return pageMetadata(category?.name || (locale === 'fa' ? 'فروشگاه' : 'Shop'), category?.description || '', category ? categoryPath(category.slug,locale) : `/${locale}/shop`, category?.seo, site, locale, faceted,category?.imageUrl);
}

/** Paginates on the API, renders real products in initial HTML and reuses the existing interactive catalog cards. */
export async function CatalogRoute({params,slug}: {params: CatalogSearchParams; slug?: string}) {
  const [site,locale,tree,brands,colors,category] = await Promise.all([readSeoSite(),requestLocale(),readCategoryTree(),readCatalogBrands(),readCatalogColors(),slug ? readCatalogCategory(slug) : undefined]);
  if (slug && category && slug !== category.slug) permanentRedirect(categoryPath(category.slug,locale));
  const result = await readCatalogSearch(catalogQuery(params,category?.slug));
  return <>{category ? <script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredJson(categorySchema(category,result.products,site,locale))}} /> : null}<CatalogPage result={result} tree={tree} brands={brands} colors={colors} category={category} /></>;
}
