import { cache } from 'react';
import axios from 'axios';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { http } from './http';
import { pageMetadata } from './catalog-seo';
import type { CatalogCategory, CatalogProductDto, CatalogSearchParams, CatalogSearchResult, CategoryDetail, SiteSeoSettings } from './catalog-contracts';

/** Server-only public reads: 404 is distinguished from temporary failures, and no mock product is substituted. */
async function read<T>(path: string): Promise<T> {
  try { return (await http.get<T>(path, { headers:{'Cache-Control':'no-cache'} })).data; }
  catch(error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) notFound();
    throw new Error('The catalog is temporarily unavailable. Please try again.');
  }
}

/** React request memoization shares product/settings reads between metadata and the page body. */
export const readCatalogProduct = cache((identifier: string) => read<CatalogProductDto>(`/catalog/products/${encodeURIComponent(identifier)}`));
export const readCatalogCategory = cache((slug: string) => read<CategoryDetail>(`/catalog/categories/${encodeURIComponent(slug)}`));
export const readCategoryTree = cache(() => read<CatalogCategory[]>('/catalog/categories/tree'));
export const readSeoSite = cache(() => read<SiteSeoSettings>('/catalog/seo'));
export const readCatalogSearch = cache((query: string) => read<CatalogSearchResult>(`/catalog/products/search?${query}`));
export const readCatalogBrands = cache(() => read<Array<{id: string; name: string; slug: string}>>('/catalog/brands'));
export const readCatalogColors = cache(() => read<Array<{id: string; name: string; slug: string}>>('/catalog/colors'));
export async function requestLocale(): Promise<'fa'|'en'> { return (await headers()).get('x-vendora-locale') === 'en' ? 'en' : 'fa'; }

/** Applies the configured site title pattern and launch gate to existing public information pages. */
export async function staticPageMetadata(fa: string, en: string, path: string, indexable = true) {
  const [site,locale] = await Promise.all([readSeoSite(),requestLocale()]);
  return pageMetadata(locale === 'fa' ? fa : en,'',`/${locale}${path}`,null,site,locale,!indexable);
}

/** Normalizes legacy query names without losing repeated category/brand/color selections. */
export function catalogQuery(params: CatalogSearchParams, baseCategory?: string): string {
  const query = new URLSearchParams();
  for (const key of ['search','category','brand','color','priceMin','priceMax','inStock','sort','page']) {
    const input = params[key];
    for (const value of Array.isArray(input) ? input : input ? [input] : []) query.append(key,value);
  }
  if (!query.has('category') && params.Category) for (const value of Array.isArray(params.Category) ? params.Category : [params.Category]) query.append('category',value);
  if (!query.has('search') && typeof params.query === 'string') query.set('search',params.query);
  if (!query.has('priceMax') && typeof params.max === 'string') query.set('priceMax',params.max);
  if (baseCategory) query.set('baseCategory',baseCategory);
  return query.toString();
}
