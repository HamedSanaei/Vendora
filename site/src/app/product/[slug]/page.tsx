import { ProductRoute, productMetadata } from '@/components/vendora/catalog/product-route';

interface ProductPageProps {params:Promise<{slug:string}>}
/** Canonical localized product route; the locale is provided by the existing rewrite middleware. */
export async function generateMetadata({params}:ProductPageProps) {return productMetadata((await params).slug);}
export default async function ProductPage({params}:ProductPageProps) {return <ProductRoute identifier={(await params).slug} />;}
