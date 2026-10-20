import { staticPageMetadata } from "@/lib/catalog.server";
import { AboutPage } from "@components/vendora/about/about-page";

/** Shared site title and launch policy for this public page. */
export async function generateMetadata() { return staticPageMetadata("درباره ما","About","/about"); }

export default function About() {
  return <AboutPage />;
}
