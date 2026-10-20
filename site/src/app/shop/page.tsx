import { CatalogRoute, catalogMetadata } from '@/components/vendora/catalog/catalog-route';
import type { CatalogSearchParams } from '@/lib/catalog-contracts';

/** Shared locale-aware shop server entry; URL parameters are the single filter source. */
export async function generateMetadata({searchParams}: {searchParams: Promise<CatalogSearchParams>}) { return catalogMetadata(await searchParams); }
export default async function ShopPage({searchParams}: {searchParams: Promise<CatalogSearchParams>}) { return <CatalogRoute params={await searchParams} />; }
