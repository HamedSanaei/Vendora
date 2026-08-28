import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { OrdersListContent } from "@/components/vendora/account/orders-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.orders.title} | Vendora` };
}

/** Order history screen (Penpot "Vendora · 08 Orders & Returns"). */
export default async function AccountOrdersPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.orders.crumb },
      ]}
      title={t.account.orders.title}
      subtitle={t.account.orders.subtitle}
    >
      <OrdersListContent locale={locale} />
    </AccountScreen>
  );
}
