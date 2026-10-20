import type { MetadataRoute } from 'next';
import { http } from '@/lib/http';
import { readSeoSite } from '@/lib/catalog.server';
import { publicUrl } from '@/lib/catalog-seo';

export const dynamic = 'force-dynamic';
/** Only published, indexable Persian URLs are supplied by the backend launch gate. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await readSeoSite();
  if (!site.isIndexingEnabled || !site.siteUrl) return [];
  const {data} = await http.get<Array<{path:string;lastModified:string|null}>>('/catalog/seo/sitemap');
  return data.map(entry => ({url:publicUrl(entry.path,site),...(entry.lastModified ? {lastModified:entry.lastModified} : {})}));
}
