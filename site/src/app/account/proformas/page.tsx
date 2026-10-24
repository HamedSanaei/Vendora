import { Suspense } from "react";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { ProformasContent } from "@/components/vendora/account/proformas-content";
import { documentCopy } from "@/lib/accounting-documents";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";

/** Uses the existing localized account route/layout and the approved My Proformas frames. */
export default async function ProformasPage() {
  const locale = await getServerLocale(), t = documentCopy[locale], common = getDict(locale);
  return <AccountScreen title={t.title} subtitle={t.subtitle} crumbs={[{ label: common.common.home, href: withLocalePath("/", locale) }, { label: common.account.crumbRoot, href: withLocalePath("/account", locale) }, { label: t.title }]}><Suspense fallback={<p>{t.loading}</p>}><ProformasContent locale={locale} /></Suspense></AccountScreen>;
}

export const metadata = { robots: { index: false, follow: false } };
