import { staticPageMetadata } from "@/lib/catalog.server";
import Footer from "@layout/footer";
import Header from "@layout/header";
import Wrapper from "@layout/wrapper";
import FaqBreadcrumb from "@components/faq/faq-breadcrumb";
import FaqArea from "@components/faq/faq-area";

/** Shared site title and launch policy for this public page. */
export async function generateMetadata() { return staticPageMetadata("پرسش‌های متداول","FAQ","/faq"); }

export default function Faq() {
  return (
    <Wrapper>
      <Header style_2={true} />
      <FaqBreadcrumb />
      <FaqArea />
      <Footer />
    </Wrapper>
  );
}
