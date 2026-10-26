import MainProvider from "@components/provider/main-provider";
import "./globals.scss";
import "./vendora.css";
import { headers } from "next/headers";
import { readSeoSite } from "@/lib/catalog.server";
import { pageMetadata } from "@/lib/catalog-seo";
import { readStoreSettings } from "@/lib/store-settings.server";
import { StoreSettingsProvider } from "@/components/vendora/layout/store-settings-provider";
import { homepageTitle, storePresentation } from "@/lib/store-settings";
import { resolveApiImageUrl } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Launch gate and private/faceted-route robots apply even to legacy pages. */
export async function generateMetadata() {
  const [site, requestHeaders, profile] = await Promise.all([readSeoSite(), headers(), readStoreSettings()]);
  const locale = requestHeaders.get("x-vendora-locale") === "en" ? "en" : "fa";
  const path = requestHeaders.get("x-vendora-pathname") || `/${locale}`;
  const privatePage = /^\/(fa|en)\/(account|cart|checkout|shipping|login|register|order|search|wishlist|user-dashboard|forgot|forget-password|admin)(\/|$)/.test(path);
  const metadata = pageMetadata(storePresentation(profile, locale).name, "", path, null, site, locale, privatePage || requestHeaders.get("x-vendora-faceted") === "1");
  if (path === `/${locale}` || path === `/${locale}/`) {
    const title = homepageTitle(profile, locale);
    metadata.title = { absolute: title };
    metadata.openGraph = { ...metadata.openGraph, title };
    metadata.twitter = { ...metadata.twitter, title };
  }
  return { ...metadata, ...(profile.faviconUrl ? { icons: { icon: resolveApiImageUrl(profile.faviconUrl) } } : {}) };
}

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-vendora-locale") === "en" ? "en" : "fa";
  const dir = locale === "fa" ? "rtl" : "ltr";
  const profile = await readStoreSettings();

  return (
    <html lang={locale} dir={dir}>
      <body>
        <StoreSettingsProvider profile={profile}><MainProvider>{children}</MainProvider></StoreSettingsProvider>
      </body>
    </html>
  );
}
