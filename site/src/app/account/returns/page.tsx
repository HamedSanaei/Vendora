import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { ReturnsListContent } from "@/components/vendora/account/returns-content";
import { VendoraButton } from "@/components/vendora/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.returns.title} | Vendora` };
}

/** Return requests list (Penpot "Return List / Desktop|Mobile"). */
export default async function AccountReturnsPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.returns.crumb },
      ]}
      title={t.account.returns.title}
      subtitle={t.account.returns.subtitle}
      action={
        <VendoraButton href={withLocalePath("/account/returns/new", locale)}>
          {t.account.returns.newReturn}
        </VendoraButton>
      }
    >
      <ReturnsListContent locale={locale} />
    </AccountScreen>
  );
}
