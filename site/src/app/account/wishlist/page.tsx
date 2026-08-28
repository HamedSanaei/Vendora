import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { WishlistContent } from "@/components/vendora/account/wallet-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return { title: `${getDict(locale).account.wishlist.title} | Vendora` };
}

/** Account wishlist screen (Penpot "Vendora · 09 Wishlist & Transactions"). */
export default async function AccountWishlistPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot, href: withLocalePath("/account", locale) },
        { label: t.account.wishlist.crumb },
      ]}
      title={t.account.wishlist.title}
      subtitle={t.account.wishlist.subtitle}
    >
      <WishlistContent locale={locale} />
    </AccountScreen>
  );
}
