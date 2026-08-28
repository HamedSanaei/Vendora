import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { ProfileForm } from "@/components/vendora/account/account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.profile.title} | Vendora` };
}

/** Edit profile screen (Penpot "Vendora · 06 Profile & Security"). */
export default async function AccountProfilePage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.profile.crumb },
      ]}
      title={t.account.profile.title}
      subtitle={t.account.profile.subtitle}
    >
      <ProfileForm locale={locale} />
    </AccountScreen>
  );
}
