import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { OrderDetailContent } from "@/components/vendora/account/orders-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.orders.detail.titlePrefix} | Vendora` };
}

/**
 * Order detail screen (Penpot "Order Detail / Desktop|Mobile").
 * The mock record VD-1048 is rendered for every id until the order API exists.
 */
export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [locale, resolved] = await Promise.all([getServerLocale(), params]);
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.orders.crumb, href: withLocalePath("/account/orders", locale) },
        { label: `${t.account.orders.detail.titlePrefix} #${localizeDigits(resolved.id.toUpperCase(), locale)}` },
      ]}
      title={`${t.account.orders.detail.titlePrefix} #${localizeDigits(resolved.id.toUpperCase(), locale)}`}
      subtitle={`${t.account.orders.detail.placedPrefix} ${
        locale === "fa" ? localizeDigits("۲۴ مرداد ۱۴۰۵", locale) : "Aug 15, 2026"
      }`}
    >
      <OrderDetailContent orderId={resolved.id} locale={locale} />
    </AccountScreen>
  );
}
