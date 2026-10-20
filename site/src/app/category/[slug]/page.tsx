import { CatalogRoute, catalogMetadata } from '@/components/vendora/catalog/catalog-route';
import type { CatalogSearchParams } from '@/lib/catalog-contracts';

type Props = {params: Promise<{slug: string}>; searchParams: Promise<CatalogSearchParams>};
/** Category metadata and HTML are both generated from the same visible, current category. */
export async function generateMetadata({params,searchParams}: Props) { return catalogMetadata(await searchParams,(await params).slug); }
export default async function CategoryPage({params,searchParams}: Props) { return <CatalogRoute params={await searchParams} slug={(await params).slug} />; }
