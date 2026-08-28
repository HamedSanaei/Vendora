import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { QuickPayForm } from "@/components/vendora/account/quickpay-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.quickPay.title} | Vendora` };
}

/** Quick payment screen (Penpot "Quick Pay / Desktop|Mobile"). */
export default async function AccountQuickPayPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.quickPay.crumb },
      ]}
      title={t.account.quickPay.title}
      subtitle={t.account.quickPay.subtitle}
    >
      <QuickPayForm locale={locale} />
    </AccountScreen>
  );
}
