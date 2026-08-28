import type { Metadata } from "next";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import {
  ClubCard,
  ProfileSummaryCard,
  QuickActionsSection,
  RecentOrdersCard,
  SupportNoticeCard,
} from "@/components/vendora/account/dashboard-cards";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return { title: `${t.account.dashboard.title} | Vendora` };
}

/** Account dashboard (Penpot "Vendora · 05 Account Dashboard"). */
export default async function AccountOverviewPage() {
  const locale = await getServerLocale();
  const t = getDict(locale);
  return (
    <AccountScreen
      crumbs={[
        { label: t.common.home, href: withLocalePath("/", locale) },
        { label: t.account.crumbRoot },
      ]}
      title={t.account.dashboard.title}
      subtitle={t.account.dashboard.subtitle}
    >
      <div className="grid gap-6 lg:!mt-[-17px] xl:grid-cols-[minmax(0,1fr)_272px] xl:gap-[28px]">
        <ProfileSummaryCard locale={locale} />
        <ClubCard locale={locale} />
      </div>
      <QuickActionsSection locale={locale} />
      <RecentOrdersCard locale={locale} />
      <SupportNoticeCard locale={locale} />
    </AccountScreen>
  );
}
