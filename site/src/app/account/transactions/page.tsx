import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { TransactionsContent } from "@/components/vendora/account/wallet-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.transactions.title} | Vendora` };
}

/** Transactions screen (Penpot "Transactions / Desktop|Mobile"). */
export default async function AccountTransactionsPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.transactions.crumb },
      ]}
      title={t.account.transactions.title}
      subtitle={t.account.transactions.subtitle}
    >
      <TransactionsContent locale={locale} />
    </AccountScreen>
  );
}
