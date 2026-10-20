import type { MetadataRoute } from 'next';
import { readSeoSite } from '@/lib/catalog.server';
import { publicUrl } from '@/lib/catalog-seo';

export const dynamic = 'force-dynamic';
/** Crawling is explicitly disabled before launch; private pages are never listed or encouraged. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await readSeoSite();
  if (!site.isIndexingEnabled || !site.siteUrl) return {rules:{userAgent:'*',disallow:'/'}};
  return {rules:{userAgent:'*',allow:'/fa',disallow:['/en','/fa/account','/fa/cart','/fa/checkout','/fa/shipping','/fa/login','/fa/register','/fa/order','/fa/search','/fa/wishlist','/fa/admin']},sitemap:publicUrl('/sitemap.xml',site)};
}
