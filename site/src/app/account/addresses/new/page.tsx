import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { AddressFormContent } from "@/components/vendora/account/addresses-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.addresses.form.titleAdd} | Vendora` };
}

/** Add / edit address screen (Penpot "Add Edit Address"). */
export default async function AccountAddressNewPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.addresses.crumb, href: withLocalePath("/account/addresses", locale) },
        { label: t.account.addresses.form.crumbAdd },
      ]}
      title={t.account.addresses.form.titleAdd}
      subtitle={t.account.addresses.form.subtitle}
    >
      <AddressFormContent locale={locale} />
    </AccountScreen>
  );
}
