import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { PasswordForm } from "@/components/vendora/account/account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.security.title} | Vendora` };
}

/** Change password screen (Penpot "Change Password / Desktop"). */
export default async function AccountSecurityPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.security.crumb },
      ]}
      title={t.account.security.title}
      subtitle={t.account.security.subtitle}
    >
      <PasswordForm locale={locale} />
    </AccountScreen>
  );
}
