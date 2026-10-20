import { CatalogRoute } from "@/components/vendora/catalog/catalog-route";
import { staticPageMetadata } from "@/lib/catalog.server";

export async function generateMetadata() { return staticPageMetadata("نتایج جستجو","Search","/search",false); }

export default async function SearchPage({searchParams}) {
  return <CatalogRoute params={await searchParams} />;
}
