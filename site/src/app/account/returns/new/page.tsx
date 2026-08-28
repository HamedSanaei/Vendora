import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { ReturnNewForm } from "@/components/vendora/account/returns-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.returns.new.title} | Vendora` };
}

/** New return request form (Penpot "Return Request / Desktop|Mobile"). */
export default async function AccountReturnNewPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.returns.crumb, href: withLocalePath("/account/returns", locale) },
        { label: t.account.returns.new.crumb },
      ]}
      title={t.account.returns.new.title}
      subtitle={t.account.returns.new.subtitle}
    >
      <ReturnNewForm locale={locale} />
    </AccountScreen>
  );
}
