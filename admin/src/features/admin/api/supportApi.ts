import { httpClient } from '../../../lib/api/httpClient';
export interface SupportTicket { id:string; subject:string; status:string; userId:string; orderId?:string; version:number; updatedAtUtc:string; customerName?:string }
export interface SupportMessage { id:string; author:string; isStaff:boolean; text:string; createdAtUtc:string }
export interface SupportDetail { ticket:SupportTicket; messages:SupportMessage[] }
export interface SupportPage { page:number; total:number; items:SupportTicket[] }
/** Reads the real support queue with persistent URL filters. */
export async function supportTickets(page:number,status:string):Promise<SupportPage> { return (await httpClient.get<SupportPage>('/api/admin/tickets',{params:{page,status:status||undefined}})).data; }
/** The server rechecks Admin authorization for every private conversation. */
export async function supportTicket(id:string):Promise<SupportDetail> { return (await httpClient.get<SupportDetail>(`/api/admin/tickets/${encodeURIComponent(id)}`)).data; }
/** Posts an official authored reply or explicit status change, preserving the key after lost responses/refresh. */
export async function supportWrite(id:string,payload:object,kind:'reply'|'status'):Promise<void> {
  const slot='vendora-admin-ticket:'+kind+':'+id,fingerprint=JSON.stringify(payload);
  let prior:{fingerprint:string;key:string}|null=null;
  try { prior=JSON.parse(sessionStorage.getItem(slot)??'null'); } catch { /* Ignore untrusted local metadata. */ }
  const key=prior?.fingerprint===fingerprint?prior.key:crypto.randomUUID();sessionStorage.setItem(slot,JSON.stringify({fingerprint,key}));
  await httpClient.request({url:`/api/admin/tickets/${encodeURIComponent(id)}/${kind==='reply'?'messages':'status'}`,method:kind==='reply'?'POST':'PATCH',data:payload,headers:{'Idempotency-Key':key}});
  sessionStorage.removeItem(slot);
}
