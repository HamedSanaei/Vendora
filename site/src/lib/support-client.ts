"use client";
import { http } from "./http";
import { accountToken } from "./auth/customer-profile";

export interface TicketSummary { id: string; subject: string; status: "WaitingForSupport"|"WaitingForCustomer"|"Closed"; userId: string; orderId?: string; version: number; updatedAtUtc: string }
export interface TicketEntry { id: string; author: string; isStaff: boolean; text: string; createdAtUtc: string }
export interface TicketDetails { ticket: TicketSummary; messages: TicketEntry[] }
export interface TicketPage { total: number; page: number; items: TicketSummary[] }
/** Uses the same session transport as the rest of the account; raw HTTP stays outside UI components. */
function auth() { return { headers: { Authorization: `Bearer ${accountToken() ?? ""}` } }; }
/** Reads only the current customer's paginated conversations. */
export async function myTickets(page: number, status: string, signal?: AbortSignal): Promise<TicketPage> { return (await http.get<TicketPage>("/account/tickets", { ...auth(), params: { page, status: status || undefined }, signal })).data; }
/** Ownership checks are performed again on the server for each conversation. */
export async function myTicket(id: string, signal?: AbortSignal): Promise<TicketDetails> { return (await http.get<TicketDetails>(`/account/tickets/${encodeURIComponent(id)}`, { ...auth(), signal })).data; }
/** Loads owned orders only while the user opens the new-ticket form. */
export async function ticketOrders(signal?: AbortSignal): Promise<Array<{ id: string; orderNumber: string }>> { return (await http.get<Array<{ id: string; orderNumber: string }>>("/orders/me", { ...auth(), signal })).data; }
/** Retains the operation key across network retries/refresh; a deliberately changed draft is a new operation. */
export async function ticketWrite(kind: "create"|"reply"|"status", id: string | undefined, payload: object): Promise<string> {
  const slot = "vendora-ticket-operation:" + kind + ":" + (id ?? "new");
  const fingerprint = JSON.stringify(payload);
  let saved: { fingerprint: string; key: string } | null = null;
  try { saved = JSON.parse(sessionStorage.getItem(slot) ?? "null"); } catch { /* Untrusted local metadata is not a business authority. */ }
  const key = saved?.fingerprint === fingerprint ? saved.key : crypto.randomUUID();
  sessionStorage.setItem(slot,JSON.stringify({ fingerprint,key }));
  const url = `/account/tickets${kind === "create" ? "" : `/${encodeURIComponent(id ?? "")}/${kind === "reply" ? "messages" : "status"}`}`;
  const response = await http.request<{id:string}>({ url, method: kind === "status" ? "PATCH" : "POST", data: payload,
    headers: { ...auth().headers, "Idempotency-Key": key } });
  sessionStorage.removeItem(slot); return response.data.id;
}
