import { staticPageMetadata } from "@/lib/catalog.server";
import Footer from "@layout/footer";
import Header from "@layout/header";
import Wrapper from "@layout/wrapper";
import SectionTop from "@components/terms-policy/section-top-bar";
import PolicyArea from "@components/terms-policy/policy-area";

/** Shared site title and launch policy for this public page. */
export async function generateMetadata() { return staticPageMetadata("حریم خصوصی","Privacy policy","/policy"); }

export default function Policy() {
  return (
    <Wrapper>
      <Header style_2={true} />
      <SectionTop
        title="Privacy Policy"
        subtitle={
          <>
            Your privacy is important to us. It is Harry’s policy to respect
            your privacy regarding <br /> any information we may collect from
            you across our website, https:// Harry.com, <br /> and other sites
            we own and operate.
          </>
        }
      />
      <PolicyArea />
      <Footer />
    </Wrapper>
  );
}
