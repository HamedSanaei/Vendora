"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { myTickets, myTicket, ticketOrders, ticketWrite, type TicketPage, type TicketDetails } from "@/lib/support-client";
import { completeProfileHref, readCustomerAccount } from "@/lib/auth/customer-profile";
import { withLocalePath } from "@/lib/locale-path";
import { formatDate } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";
import { VendoraButton } from "../ui/button";
import { TextField, TextareaField } from "../ui/form-field";

/** Private ticket workspace built from the existing account/form/button components, preserving drafts on failure. */
export function TicketsContent({ locale, ticketId }: { locale: Locale; ticketId?: string }) {
  const fa = locale === "fa", router = useRouter(), search = useSearchParams();
  const page = Math.max(1,Number(search.get("page")) || 1), status = search.get("status") ?? "";
  const [revision,setRevision] = useState(0), [data,setData] = useState<{key:string; list?:TicketPage; detail?:TicketDetails; error?:string}>({key:""});
  const [subject,setSubject] = useState(""), [text,setText] = useState(""), [order,setOrder] = useState(""), [orders,setOrders] = useState<Array<{id:string;orderNumber:string}>>([]), [creating,setCreating] = useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const key = `${ticketId ?? "list"}:${page}:${status}:${revision}`, base = withLocalePath("/account/tickets",locale);
  useEffect(() => {
    const abort = new AbortController();
    (ticketId ? myTicket(ticketId,abort.signal).then(detail => ({detail})) : myTickets(page,status,abort.signal).then(list => ({list})))
      .then(value => { if (!abort.signal.aborted) setData({key,...value}); }).catch(failure => { if (!abort.signal.aborted) setData({key,error: failureMessage(failure,fa)}); });
    return () => abort.abort();
  },[ticketId,page,status,key,fa]);
  useEffect(() => { if (!creating) return; const abort = new AbortController(); ticketOrders(abort.signal).then(setOrders).catch(() => { /* Ticket creation remains usable without linking an order. */ }); return () => abort.abort(); },[creating]);
  /** Writes with the server version and a durable idempotency key; errors preserve subject/reply text. */
  async function submit(event?:FormEvent, close?:boolean) {
    event?.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      if (close === undefined) { const account=await readCustomerAccount(); if (!account.completion?.isComplete) { router.push(completeProfileHref(locale,ticketId ? `${base}/${ticketId}` : base)); return; } }
      if (!ticketId) { const id = await ticketWrite("create",undefined,{subject,text,orderId:order || null}); setSubject(""); setText(""); router.push(`${base}/${id}`); }
      else if (close !== undefined) { await ticketWrite("status",ticketId,{version:data.detail?.ticket.version,close}); setRevision(value => value+1); }
      else { await ticketWrite("reply",ticketId,{version:data.detail?.ticket.version,text}); setText(""); setRevision(value => value+1); }
    } catch (failure) { setError(failureMessage(failure,fa)); } finally { setBusy(false); }
  }
  const loaded = data.key === key, detail = loaded ? data.detail : undefined;
  return <section className="space-y-5" dir={fa ? "rtl" : "ltr"}>
    <div className="flex flex-wrap items-center justify-between gap-3">{ticketId ? <VendoraButton href={base} variant="outline">{fa ? "همه تیکت‌ها" : "All tickets"}</VendoraButton> : <VendoraButton type="button" onClick={() => setCreating(value => !value)}>{fa ? "تیکت جدید" : "New ticket"}</VendoraButton>}</div>
    {creating && !ticketId && <form onSubmit={submit} className="grid gap-4 rounded-card border border-vd-line bg-white p-5"><TextField label={fa ? "موضوع" : "Subject"} required maxLength={200} value={subject} onChange={event => setSubject(event.target.value)} /><label className="grid gap-2 text-sm font-semibold">{fa ? "سفارش مرتبط (اختیاری)" : "Related order (optional)"}<select aria-label={fa ? "سفارش مرتبط (اختیاری)" : "Related order (optional)"} className="vd-focus min-h-11 w-full min-w-0 rounded-control border border-vd-line bg-white p-3" value={order} onChange={event => setOrder(event.target.value)}><option value="">{fa ? "بدون سفارش مرتبط" : "No related order"}</option>{orders.map(item => <option key={item.id} value={item.id}>{item.orderNumber}</option>)}</select></label><TextareaField label={fa ? "پیام شما" : "Your message"} required maxLength={3000} rows={5} value={text} onChange={event => setText(event.target.value)} /><VendoraButton type="submit" disabled={busy}>{fa ? "ثبت تیکت" : "Create ticket"}</VendoraButton></form>}
    {!ticketId && <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">{fa ? "وضعیت" : "Status"}<select className="vd-focus min-h-11 max-w-full rounded-control border border-vd-line bg-white px-3" value={status} onChange={event => router.push(`${base}?status=${event.target.value}`)}><option value="">{fa ? "همه" : "All"}</option>{["WaitingForSupport","WaitingForCustomer","Closed"].map(value => <option key={value} value={value}>{ticketStatus(value,fa)}</option>)}</select></label>}
    {!loaded && <p role="status">{fa ? "در حال دریافت تیکت‌ها…" : "Loading tickets…"}</p>}
    {loaded && data.error && <p role="alert" className="rounded-control bg-vd-danger-tint p-4 text-sm text-vd-danger">{data.error}<VendoraButton type="button" variant="ghost" onClick={() => setRevision(value => value+1)}>{fa ? "تلاش مجدد" : "Retry"}</VendoraButton></p>}
    {loaded && data.list && <><ul className="m-0 list-none space-y-3 p-0">{data.list.items.map(item => <li key={item.id} className="rounded-card border border-vd-line bg-white p-5"><Link className="vd-focus flex flex-wrap items-center justify-between gap-3" href={`${base}/${item.id}`}><strong className="min-w-0 break-words text-base">{item.subject}</strong><span className="rounded-full bg-jade-tint px-3 py-2 text-xs font-bold text-jade">{ticketStatus(item.status,fa)}</span><time className="text-sm text-vd-muted">{formatDate(item.updatedAtUtc,locale)}</time></Link></li>)}</ul>{!data.list.items.length && <p className="rounded-card bg-surface-soft p-7 text-sm">{fa ? "هنوز تیکتی ثبت نکرده‌اید." : "No tickets yet."}</p>}<div className="flex justify-between gap-3"><VendoraButton variant="outline" href={`${base}?page=${Math.max(1,page-1)}&status=${status}`} className={page===1 ? "pointer-events-none opacity-40" : ""}>{fa ? "قبلی" : "Previous"}</VendoraButton><VendoraButton variant="outline" href={`${base}?page=${page+1}&status=${status}`} className={page*25>=data.list.total ? "pointer-events-none opacity-40" : ""}>{fa ? "بعدی" : "Next"}</VendoraButton></div></>}
    {detail && <div className="rounded-card border border-vd-line bg-white p-5 md:p-7"><h2 className="break-words text-xl font-extrabold">{detail.ticket.subject}</h2><p className="my-4 text-sm font-bold text-jade">{ticketStatus(detail.ticket.status,fa)}</p><ol className="m-0 list-none space-y-4 p-0">{detail.messages.map(message => <li key={message.id} className={`rounded-control border border-vd-line p-4 ${message.isStaff ? "bg-jade-tint" : "bg-surface-soft"}`}><div className="flex flex-wrap justify-between gap-3 text-sm font-bold"><span>{message.author || (fa ? "کاربر" : "User")}{message.isStaff && <span className="ms-2 text-jade">{fa ? "پاسخ پشتیبانی" : "Support"}</span>}</span><time className="text-xs font-normal text-vd-muted">{formatDate(message.createdAtUtc,locale)}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-8">{message.text}</p></li>)}</ol>{detail.ticket.status !== "Closed" && <form onSubmit={submit} className="mt-6 grid gap-4"><TextareaField label={fa ? "پاسخ شما" : "Your reply"} required maxLength={3000} rows={4} value={text} onChange={event => setText(event.target.value)} /><VendoraButton type="submit" disabled={busy}>{fa ? "ارسال پاسخ" : "Send reply"}</VendoraButton></form>}<VendoraButton type="button" disabled={busy} variant="outline" className="mt-5" onClick={() => void submit(undefined,detail.ticket.status !== "Closed")}>{detail.ticket.status === "Closed" ? (fa ? "بازگشایی تیکت" : "Reopen ticket") : (fa ? "بستن تیکت" : "Close ticket")}</VendoraButton></div>}
    {error && <p role="alert" className="rounded-control bg-vd-danger-tint p-4 text-sm text-vd-danger">{error}<VendoraButton type="button" variant="ghost" onClick={() => setRevision(value => value+1)}>{fa ? "دریافت تازه" : "Reload"}</VendoraButton></p>}
  </section>;
}

/** Maps stable status values without substring-based badge mistakes. */
function ticketStatus(status:string,fa:boolean) { return ({WaitingForSupport:fa?"منتظر پشتیبانی":"Waiting for support",WaitingForCustomer:fa?"منتظر مشتری":"Waiting for customer",Closed:fa?"بسته":"Closed"} as Record<string,string>)[status] ?? status; }
/** Preserves sessions/drafts on server failures and distinguishes stale versions from ownership failures. */
function failureMessage(error:unknown,fa:boolean) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status===409) return fa ? "تیکت تغییر کرده یا بسته شده است؛ اطلاعات را تازه کنید. متن شما حفظ شده است." : "Ticket changed or closed. Reload; your draft is preserved.";
    if (error.response?.status===404) return fa ? "این تیکت در دسترس شما نیست." : "Ticket unavailable.";
    if (error.response?.status===429) return fa ? "تعداد درخواست‌ها زیاد است؛ کمی صبر کنید." : "Too many requests. Please wait.";
  }
  return fa ? "عملیات انجام نشد؛ دوباره تلاش کنید. متن شما حفظ شده است." : "Request failed. Retry; your draft is preserved.";
}
