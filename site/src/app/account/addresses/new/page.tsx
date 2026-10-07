import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { AddressFormContent } from "@/components/vendora/account/address-form-content";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ id?: string }> }): Promise<Metadata> {
  const locale = await getServerLocale();
  const { id } = await searchParams;
  const form = getDict(locale).account.addresses.form;
  return { title: `${id ? form.titleEdit : form.titleAdd} | Vendora` };
}

/** Add/edit address screen with runtime, domain-restricted Neshan web configuration. */
export default async function AccountAddressNewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const locale = await getServerLocale();
  const { id } = await searchParams;
  const t = getDict(locale);
  const title = id ? t.account.addresses.form.titleEdit : t.account.addresses.form.titleAdd;
  const configuredKey = process.env.NESHAN_WEB_API_KEY?.trim() ?? "";
  // Never serialize a private service key into the browser's page payload.
  const mapApiKey = configuredKey.startsWith("web.") ? configuredKey : "";
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.addresses.crumb, href: withLocalePath("/account/addresses", locale) },
        { label: title },
      ]}
      title={title}
      subtitle={t.account.addresses.form.subtitle}
    >
      <AddressFormContent locale={locale} addressId={id} mapApiKey={mapApiKey} mapKeyInvalid={Boolean(configuredKey) && !mapApiKey} />
    </AccountScreen>
  );
}
