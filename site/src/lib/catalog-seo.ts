import type { Metadata } from 'next';
import type { CatalogProductDto, CategoryDetail, SeoMetadataDto, SiteSeoSettings } from './catalog-contracts';
import { resolveApiImageUrl } from './http';

/** Uses a configured canonical origin; a prelaunch localhost fallback is never indexable. */
export function siteOrigin(site: SiteSeoSettings): string { return site.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; }
export function publicUrl(path: string, site: SiteSeoSettings): string { return new URL(path,siteOrigin(site)).toString(); }
export function productPath(slug: string, locale = 'fa'): string { return `/${locale}/product/${encodeURIComponent(slug)}`; }
export function categoryPath(slug: string, locale = 'fa'): string { return `/${locale}/category/${encodeURIComponent(slug)}`; }

/** Builds server metadata using the same editorial defaults as the deterministic assessment. */
export function pageMetadata(name: string, description: string, path: string, seo: SeoMetadataDto | null | undefined, site: SiteSeoSettings, locale = 'fa', faceted = false, imageUrl?: string | null): Metadata {
  const fields = seo?.fields;
  const title = fields?.title?.trim() || site.titleTemplate.replaceAll('{title}',name).replaceAll('{siteName}',site.siteName);
  const summary = fields?.description?.trim() || defaultSummary(description) || site.defaultDescription || '';
  const canonical = fields?.canonicalUrl || publicUrl(path,site);
  const imageSource = fields?.socialImageUrl || imageUrl || site.logoUrl;
  const image = imageSource ? publicUrl(resolveApiImageUrl(imageSource), site) : undefined;
  return { title:{absolute:title},description:summary,alternates:{canonical},
    robots:{index:locale === 'fa' && site.isIndexingEnabled && Boolean(site.siteUrl) && fields?.index !== false && !faceted,follow:fields?.follow !== false},
    openGraph:{type:'website',title:fields?.socialTitle || title,description:fields?.socialDescription || summary,url:canonical,siteName:site.siteName,locale:locale === 'fa' ? 'fa_IR' : 'en_US',...(image ? {images:[image]} : {})},
    twitter:{card:'summary_large_image',title:fields?.socialTitle || title,description:fields?.socialDescription || summary,...(image ? {images:[image]} : {})}
  };
}

/** Matches the server's 160-character editorial fallback without splitting UTF-16 surrogate pairs. */
function defaultSummary(value: string): string {
  if (value.length <= 160) return value;
  const end = value.charCodeAt(159) >= 0xd800 && value.charCodeAt(159) <= 0xdbff ? 159 : 160;
  return value.slice(0,end) + '…';
}

/** Serializes JSON-LD safely even when editorial text contains HTML/script-like strings. */
export function structuredJson(value: unknown): string { return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026'); }

export function organizationSchema(site: SiteSeoSettings) {
  return {'@type':'Organization','@id':publicUrl('/#organization',site),name:site.siteName,url:siteOrigin(site),
    ...(site.logoUrl ? {logo:site.logoUrl.startsWith('/') ? resolveApiImageUrl(site.logoUrl) : site.logoUrl} : {}),
    sameAs:(site.socialProfiles || '').split('\n').filter(url => /^https?:\/\//.test(url))};
}

/** Offers use authoritative stored Toman prices converted exactly to IRR, never a browser/exchange quote. */
export function productSchema(product: CatalogProductDto, site: SiteSeoSettings, locale = 'fa') {
  const url = publicUrl(productPath(product.slug,locale),site);
  const breadcrumbs = [{name:locale === 'fa' ? 'خانه' : 'Home',item:publicUrl(`/${locale}`,site)},
    ...(product.breadcrumbs ?? []).map(item => ({name:item.name,item:publicUrl(categoryPath(item.slug,locale),site)})),{name:product.title,item:url}];
  return {'@context':'https://schema.org','@graph':[organizationSchema(site),
    {'@type':'Product','@id':`${url}#product`,name:product.title,url,description:product.description || product.title,
      image:(product.images || []).map(image => publicUrl(resolveApiImageUrl(image.imageUrl), site)),
      ...(product.productCode >= 100 ? {sku:String(product.productCode)} : {}),
      ...(product.brandName ? {brand:{'@type':'Brand',name:product.brandName}} : {}),
      ...((product.ratingCount ?? 0) > 0 ? {aggregateRating:{'@type':'AggregateRating',ratingValue:product.rating,ratingCount:product.ratingCount,bestRating:5,worstRating:1}} : {}),
      offers:{'@type':'Offer',url,priceCurrency:'IRR',price:String(product.price * 10),availability:`https://schema.org/${product.stockQuantity > 0 ? 'InStock' : 'OutOfStock'}`,seller:{'@id':publicUrl('/#organization',site)}}},
    {'@type':'BreadcrumbList',itemListElement:breadcrumbs.map((item,index) => ({'@type':'ListItem',position:index+1,...item}))}]};
}

/** Category pages describe a collection, not fabricated product reviews or category-level offers. */
export function categorySchema(category: CategoryDetail, products: CatalogProductDto[], site: SiteSeoSettings, locale = 'fa') {
  return {'@context':'https://schema.org','@graph':[organizationSchema(site),
    {'@type':'CollectionPage',name:category.name,url:publicUrl(categoryPath(category.slug,locale),site),mainEntity:{'@type':'ItemList',itemListElement:products.map((product,index) => ({'@type':'ListItem',position:index+1,url:publicUrl(productPath(product.slug,locale),site),name:product.title}))}},
    {'@type':'BreadcrumbList',itemListElement:[{name:locale === 'fa' ? 'خانه' : 'Home',item:publicUrl(`/${locale}`,site)},...category.breadcrumbs.map(item => ({name:item.name,item:publicUrl(categoryPath(item.slug,locale),site)}))].map((item,index) => ({'@type':'ListItem',position:index+1,...item}))}]};
}
