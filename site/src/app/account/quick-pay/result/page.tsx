import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountPageFrame } from "@/components/vendora/account/account-chrome";
import { QuickPayResult } from "@/components/vendora/account/quickpay-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.quickPay.title} | Vendora` };
}

/**
 * Payment result screen (Penpot success / failed / pending frames).
 * `useSearchParams` requires a Suspense boundary during static generation.
 */
export default async function AccountQuickPayResultPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountPageFrame
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.quickPay.crumb, href: withLocalePath("/account/quick-pay", locale) },
      ]}
    >
      <Suspense fallback={<div className="min-h-[320px]" aria-busy="true" />}>
        <QuickPayResult locale={locale} />
      </Suspense>
    </AccountPageFrame>
  );
}
