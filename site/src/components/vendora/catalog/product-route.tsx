import { permanentRedirect } from 'next/navigation';
import { readCatalogProduct, readSeoSite, requestLocale } from '@/lib/catalog.server';
import { mapCatalogProduct } from '@/lib/catalog-product-mapping';
import { pageMetadata, productPath, productSchema, structuredJson } from '@/lib/catalog-seo';
import { ProductDetailPage } from './product-detail-page';

/** Metadata and body share request-scoped reads; nonexistent products remain genuine 404 responses. */
export async function productMetadata(identifier: string) {
  const [product,site,locale] = await Promise.all([readCatalogProduct(identifier),readSeoSite(),requestLocale()]);
  return pageMetadata(product.title,product.description || '',productPath(product.slug,locale),product.seo,site,locale,false,product.primaryImageUrl);
}

/** Server catalog wrapper retains the existing interactive product components and renders real content into initial HTML. */
export async function ProductRoute({identifier,legacy = false}: {identifier:string;legacy?:boolean}) {
  const [product,site,locale] = await Promise.all([readCatalogProduct(identifier),readSeoSite(),requestLocale()]);
  // Normal requests are normalized with exact 301s by the proxy; this fallback covers an internal rewrite without proxy execution.
  if (legacy || product.slug !== identifier) permanentRedirect(productPath(product.slug,locale));
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredJson(productSchema(product,site,locale))}} />
    <ProductDetailPage id={product.id} initialProduct={mapCatalogProduct(product)} /></>;
}
