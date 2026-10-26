import { Suspense } from "react";
import { AccountScreen } from "@/components/vendora/account/account-screen";
import { TicketsContent } from "@/components/vendora/account/tickets-content";
import { getServerLocale } from "@/lib/vendora/server-locale";
import { withLocalePath } from "@/lib/locale-path";

/** Uses the same account ticket component for details, with server-enforced ownership. */
export default async function TicketPage({params}:{params:Promise<{id:string}>}) {
  const locale=await getServerLocale(), {id}=await params, title=locale==="fa"?"تیکت پشتیبانی":"Support ticket";
  return <AccountScreen title={title} crumbs={[{label:locale==="fa"?"تیکت‌ها":"Tickets",href:withLocalePath("/account/tickets",locale)},{label:title}]}><Suspense><TicketsContent locale={locale} ticketId={id} /></Suspense></AccountScreen>;
}
export const metadata = { robots: { index:false,follow:false } };
