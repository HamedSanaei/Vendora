import MainProvider from "@components/provider/main-provider";
import "./globals.scss";
import { headers } from "next/headers";

export const metadata = {
  title: "Vendora Storefront",
  description: "Vendora mock storefront built from the Harri template.",
};

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
