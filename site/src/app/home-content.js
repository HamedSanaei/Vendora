import Header from "@layout/header";
import Footer from "@layout/footer";
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
export default function HomeContent() {
  return (
    <div className="vd-root vd-home">
      <Header />
      <main>
        <HeroSection />
        <QuickLinksSection />
        <PopularProductsSection />
        <BenefitsSection />
        <NewestProductsSection />
        <EditorialPromosSection />
        <CategoryCirclesSection />
        <BrandStorySection />
      </main>
      <Footer />
    </div>
  );
}
