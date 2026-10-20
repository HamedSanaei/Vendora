import Header from "@layout/header";
import Footer from "@layout/footer";
import { readCatalogSearch, readCategoryTree, readSeoSite } from "@/lib/catalog.server";
import { organizationSchema, structuredJson } from "@/lib/catalog-seo";
import {
  HeroSection,
  QuickLinksSection,
  PopularProductsSection,
  BenefitsSection,
  NewestProductsSection,
  EditorialPromosSection,
  CategoryCirclesSection,
  BrandStorySection,
} from "@components/vendora/home/sections";

/**
 * Vendora homepage composition, following the approved Penpot frame
 * "Frame / Home / Desktop / 1440" (page: Vendora · 03 Home Responsive).
 */
export default async function HomeContent() {
  const [result, categories, site] = await Promise.all([readCatalogSearch("pageSize=10"), readCategoryTree(), readSeoSite()]);
  return (
    <div className="vd-root vd-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredJson({'@context':'https://schema.org',...organizationSchema(site)})}} />
      <Header />
      <main>
        <HeroSection />
        <QuickLinksSection />
        <PopularProductsSection products={result.products.slice(0,5)} />
        <BenefitsSection />
        <NewestProductsSection products={result.products.slice(5).length ? result.products.slice(5) : result.products.slice(0,5)} />
        <EditorialPromosSection />
        <CategoryCirclesSection categories={categories} />
        <BrandStorySection />
      </main>
      <Footer />
    </div>
  );
}
