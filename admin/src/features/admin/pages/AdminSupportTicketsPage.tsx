import { useEffect,useState,type FormEvent } from 'react';
import { useParams,useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AdminButton,AdminFeedback,AdminPageHeader,AdminPagination,AdminPanel,AdminSelect,AdminTextarea } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { supportTickets,supportTicket,supportWrite,type SupportPage,type SupportDetail } from '../api/supportApi';
import { adminPath,normalizeAdminLocale } from '../i18n';

/** Extends the existing Admin shell with real support records; no mock messages or impersonated customer edits. */
export function AdminSupportTicketsPage() {
  const {locale:rawLocale,id}=useParams(),locale=normalizeAdminLocale(rawLocale),fa=locale==='fa';
  const [params,setParams]=useSearchParams(),page=Math.max(1,Number(params.get('page'))||1),status=params.get('status')??'';
  const [version,setVersion]=useState(0),[data,setData]=useState<{key:string;list?:SupportPage;detail?:SupportDetail}>({key:''}),[error,setError]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(false);
  const key=`${id??'list'}:${page}:${status}:${version}`;
  useEffect(()=>{let active=true;(id?supportTicket(id).then(detail=>({detail})):supportTickets(page,status).then(list=>({list}))).then(value=>{if(active){setData({key,...value});setError('');}}).catch(()=>{if(active)setError(fa?'دریافت تیکت انجام نشد.':'Unable to load support tickets.');});return()=>{active=false;};},[id,page,status,key,fa]);
  /** Retains reply text on network/concurrency failure; updates the version from a new detail read after success. */
  async function act(close?:boolean,event?:FormEvent){event?.preventDefault();if(busy||!id||!data.detail)return;setBusy(true);setError('');try{await supportWrite(id,close===undefined?{version:data.detail.ticket.version,text}:{version:data.detail.ticket.version,close},close===undefined?'reply':'status');if(close===undefined)setText('');setVersion(value=>value+1);}catch(cause){setError(axios.isAxiosError(cause)&&cause.response?.status===409?(fa?'تیکت تغییر کرده یا بسته شده است؛ دریافت مجدد کنید. متن شما حفظ شده است.':'Ticket changed or closed. Reload; your draft is preserved.'):(fa?'عملیات انجام نشد؛ متن شما حفظ شده است.':'Request failed; your draft is preserved.'));}finally{setBusy(false);}}
  /** Changes filter/page without erasing other query state. */
  function filter(name:string,value:string){const next=new URLSearchParams(params);if(value)next.set(name,value);else next.delete(name);if(name!=='page')next.delete('page');setParams(next);}
  const ready=data.key===key,detail=ready?data.detail:undefined;
  return <section><AdminPageHeader title={fa?'تیکت‌های پشتیبانی':'Support tickets'} description={fa?'پاسخ‌ها با هویت مدیر ثبت می‌شوند؛ متن خصوصی مشتری در پیامک ارسال نمی‌شود.':'Replies preserve staff identity. SMS notifications never include private message text.'}/>
    {error&&<AdminFeedback tone="error">{error}<AdminButton variant="secondary" onClick={()=>setVersion(value=>value+1)}>{fa?'دریافت مجدد':'Reload'}</AdminButton></AdminFeedback>}
    {!ready&&!error&&<p role="status">{fa?'در حال دریافت…':'Loading…'}</p>}
    {!id&&<AdminPanel title={fa?'صف پشتیبانی':'Support queue'}><AdminSelect label={fa?'وضعیت':'Status'} value={status} onChange={event=>filter('status',event.target.value)}><option value="">{fa?'همه':'All'}</option><option value="WaitingForSupport">{fa?'منتظر پشتیبانی':'Waiting for support'}</option><option value="WaitingForCustomer">{fa?'منتظر مشتری':'Waiting for customer'}</option><option value="Closed">{fa?'بسته':'Closed'}</option></AdminSelect>
      <div className="admin-discussions">{ready&&data.list?.items.map(ticket=><article className="admin-discussion-entry" key={ticket.id}><header><strong className="break-words">{ticket.subject}</strong><StatusBadge locale={locale} value={ticket.status}/><span>{ticket.customerName||ticket.userId}</span></header><time>{new Intl.DateTimeFormat(fa?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(ticket.updatedAtUtc))}</time><div className="admin-discussion-actions"><AdminButton to={adminPath(locale,'tickets/'+ticket.id)} variant="secondary">{fa?'مشاهده و پاسخ':'View & reply'}</AdminButton></div></article>)}</div>
      {ready&&data.list&&!data.list.items.length&&<p>{fa?'تیکتی وجود ندارد.':'No tickets.'}</p>}{ready&&data.list&&<AdminPagination locale={locale} currentPage={page} totalPages={Math.ceil(data.list.total/25)} label={fa?'صفحه':'Page'} onPageChange={value=>filter('page',String(value))}/>}</AdminPanel>}
    {detail&&<AdminPanel title={detail.ticket.subject} toolbar={<AdminButton to={adminPath(locale,'tickets')} variant="secondary">{fa?'همه تیکت‌ها':'All tickets'}</AdminButton>}><StatusBadge locale={locale} value={detail.ticket.status}/><div className="admin-discussions">{detail.messages.map(message=><article key={message.id} className="admin-discussion-entry"><header><strong>{message.author||(fa?'کاربر':'User')}</strong>{message.isStaff&&<span>{fa?'پاسخ پشتیبانی':'Support reply'}</span>}<time>{new Intl.DateTimeFormat(fa?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(message.createdAtUtc))}</time></header><p className="admin-discussion-text">{message.text}</p></article>)}</div>
      {detail.ticket.status!=='Closed'&&<form className="admin-form" onSubmit={event=>void act(undefined,event)}><AdminTextarea label={fa?'پاسخ رسمی پشتیبانی':'Official support reply'} required rows={5} maxLength={3000} value={text} disabled={busy} onChange={event=>setText(event.target.value)}/><AdminButton type="submit" disabled={busy}>{fa?'ارسال پاسخ':'Send reply'}</AdminButton></form>}
      <AdminButton disabled={busy} variant="secondary" onClick={()=>void act(detail.ticket.status!=='Closed')}>{detail.ticket.status==='Closed'?(fa?'بازگشایی تیکت':'Reopen ticket'):(fa?'بستن تیکت':'Close ticket')}</AdminButton>
    </AdminPanel>}
  </section>;
}
