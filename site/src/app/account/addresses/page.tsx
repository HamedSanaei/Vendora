import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { AddressBookContent } from "@/components/vendora/account/addresses-content";
import { VendoraButton } from "@/components/vendora/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.addresses.title} | Vendora` };
}

/** Address book screen (Penpot "Vendora · 07 Addresses"). */
export default async function AccountAddressesPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.addresses.crumb },
      ]}
      title={t.account.addresses.title}
      subtitle={t.account.addresses.subtitle}
      action={
        <VendoraButton href={withLocalePath("/account/addresses/new", locale)}>
          {t.account.addresses.add}
        </VendoraButton>
      }
    >
      <AddressBookContent locale={locale} />
    </AccountScreen>
  );
}
