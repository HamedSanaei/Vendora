import { staticPageMetadata } from "@/lib/catalog.server";
import Footer from "@layout/footer";
import Header from "@layout/header";
import Wrapper from "@layout/wrapper";
import ContactArea from "@components/contact/contact-area";
import { StoreContactInfo } from "@/components/vendora/layout/store-contact-info";

/** Shared site title and launch policy for this public page. */
export async function generateMetadata() { return staticPageMetadata("تماس با ما","Contact","/contact"); }

export default function Contact() {
  return (
    <Wrapper>
      <Header style_2={true} />
      <StoreContactInfo fallback={<ContactArea />} />
      <Footer />
    </Wrapper>
  );
}
