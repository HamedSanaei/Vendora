import { Suspense } from "react";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { TicketsContent } from "@/components/vendora/account/tickets-content";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { withLocalePath } from "@/lib/locale-path";

/** Extends the existing account shell, navigation and route rewriting instead of creating another account layout. */
export default async function TicketsPage() {
  const locale = await getServerLocale(), title = locale === "fa" ? "تیکت‌های پشتیبانی" : "Support tickets";
  return <AccountScreen title={title} crumbs={[{label:locale === "fa" ? "حساب من" : "My account",href:withLocalePath("/account",locale)},{label:title}]}><Suspense><TicketsContent locale={locale} /></Suspense></AccountScreen>;
}
export const metadata = { robots: { index:false,follow:false } };
