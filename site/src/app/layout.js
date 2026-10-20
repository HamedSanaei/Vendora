import MainProvider from "@components/provider/main-provider";
import "./globals.scss";
import "./vendora.css";
import { headers } from "next/headers";
import { readSeoSite } from "@/lib/catalog.server";
import { pageMetadata } from "@/lib/catalog-seo";

export const dynamic = "force-dynamic";

/** Launch gate and private/faceted-route robots apply even to legacy pages. */
export async function generateMetadata() {
  const [site, requestHeaders] = await Promise.all([readSeoSite(), headers()]);
  const locale = requestHeaders.get("x-vendora-locale") === "en" ? "en" : "fa";
  const path = requestHeaders.get("x-vendora-pathname") || `/${locale}`;
  const privatePage = /^\/(fa|en)\/(account|cart|checkout|shipping|login|register|order|search|wishlist|user-dashboard|forgot|forget-password|admin)(\/|$)/.test(path);
  return pageMetadata(site.siteName, "", path, null, site, locale, privatePage || requestHeaders.get("x-vendora-faceted") === "1");
}

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-vendora-locale") === "en" ? "en" : "fa";
  const dir = locale === "fa" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body>
        <MainProvider>{children}</MainProvider>
      </body>
    </html>
  );
}
