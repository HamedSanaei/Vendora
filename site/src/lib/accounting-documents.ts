import axios from "axios";
import { http } from "@/lib/http";
import { preparePdfPrintWindow } from "@/lib/pdf-browser";

export interface CommercialLine { id: string; productCode: number; title: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number }
export interface CommercialDocument { id: string; number: string; kind: string; currency: string; exchangeRate: number; issuedAtUtc: string; net: number; tax: number; freight: number; totalToman: number; shippingUndetermined: boolean; lines: CommercialLine[] }
export interface CommercialDocuments { items: CommercialDocument[]; page: number; pageSize: number; total: number }
export interface ProformaRequest { items: Array<{ productId: string; quantity: number; expectedUnitPrice: number }>; shippingMethod?: string; couponCode?: string; shippingQuoteId?: string | null; addressId?: string }
/** Safe document feedback; sign-in is requested only after the same credential is rejected by account/me. */
export interface CommercialFailure { message: string; signInRequired: boolean }

/** Reads existing authentication without inventing a token or changing sign-in behavior. */
export function documentToken(): string | null {
  try { const auth: unknown = JSON.parse(localStorage.getItem("auth") ?? "{}"); return auth && typeof auth === "object" && "accessToken" in auth && typeof auth.accessToken === "string" ? auth.accessToken : null; } catch { return null; }
}

/** Reads only the signed-in customer's saved proformas through the shared Axios instance. */
export async function myProformas(page: number, token: string, signal?: AbortSignal): Promise<CommercialDocuments> {
  return (await http.get<CommercialDocuments>("/account/documents", { params: { page, kind: 2 }, headers: { Authorization: `Bearer ${token}` }, signal })).data;
}

/** Distinguishes document access failures from rejected sessions without deleting auth or inferring JWT expiry. */
export async function commercialFailure(error: unknown, token: string, fa: boolean, signal?: AbortSignal): Promise<CommercialFailure> {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return { message: commercialError(error, fa), signInRequired: false };
  try {
    const { data } = await http.get<{ id?: string }>('/account/me', { headers: { Authorization: `Bearer ${token}` }, signal, timeout: 5000 });
    const verified = typeof data?.id === 'string' && data.id.length > 0;
    return { message: documentCopy[fa ? 'fa' : 'en'][verified ? 'accessFailed' : 'verificationFailed'], signInRequired: false };
  } catch (verificationError) {
    if (axios.isCancel(verificationError)) throw verificationError;
    const rejected = axios.isAxiosError(verificationError) && verificationError.response?.status === 401;
    return { message: rejected ? commercialError(error, fa) : documentCopy[fa ? 'fa' : 'en'].verificationFailed, signInRequired: rejected };
  }
}

/** Issues an immutable, server-priced quote using a key retained across uncertain response failures and refresh. */
export async function issueProforma(input: ProformaRequest, token: string): Promise<string> {
  const fingerprint = JSON.stringify(input) + token;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint)))).map(b => b.toString(16).padStart(2, "0")).join("");
  const slot = `vendora-proforma-${digest}`;
  const key = sessionStorage.getItem(slot) ?? crypto.randomUUID(); sessionStorage.setItem(slot, key);
  const response = await http.post<{ id: string }>("/account/documents/proformas", input, { headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key } });
  sessionStorage.removeItem(slot);
  return response.data.id;
}

/** Downloads or opens the same authenticated PDF source for printing; no private URL/token is placed in links. */
export async function commercialPdf(id: string, size: "A4" | "A5", token: string, print = false): Promise<void> {
  const printWindow = print ? preparePdfPrintWindow() : null;
  try {
    const { data } = await http.get<Blob>(`/account/documents/${id}/pdf`, { params: { size }, responseType: "blob", timeout: 60000, headers: { Authorization: `Bearer ${token}` } });
    const url = URL.createObjectURL(data);
    // Print stays in the browser's native PDF viewer; no server printer connection or document token in the URL.
    if (printWindow) printWindow.location.replace(url);
    else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${id}-${size}.pdf`; anchor.click(); }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    printWindow?.close();
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Keep safe HTTP failure. */ }
    }
    throw error;
  }
}

/** Returns user-safe feedback and distinguishes repricing from PDF configuration failures. */
export function commercialError(error: unknown, fa: boolean): string {
  if (error instanceof Error && error.message === "PDF_POPUP_BLOCKED") return fa ? "مرورگر پنجرهٔ چاپ را مسدود کرد؛ بازشدن پنجره را مجاز کنید یا PDF را دانلود و از مرورگر چاپ کنید." : "Your browser blocked the print window. Allow it or download the PDF and print it from your browser.";
  const code: unknown = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
  if (code === "PRICE_CHANGED") return fa ? "قیمت تغییر کرده است؛ سبد خرید را به‌روز کنید و دوباره درخواست دهید." : "Prices changed. Refresh your cart and request again.";
  if (typeof code === "string" && code.startsWith("PDF_")) return fa ? "سند شما ذخیره شده، اما تولید PDF فعلاً در دسترس نیست. بعداً از همین فهرست دوباره دانلود کنید." : "Your document is saved, but PDF is currently unavailable. Download again from this list later.";
  if (axios.isAxiosError(error) && error.response?.status === 401) return fa ? "اعتبار ورود شما تأیید نشد؛ دوباره وارد شوید." : "Your sign-in could not be verified. Please sign in again.";
  return fa ? "درخواست انجام نشد. اتصال را بررسی و دوباره تلاش کنید." : "Request failed. Check your connection and try again.";
}

export const documentCopy = {
  fa: { signIn: "ورود مجدد", accessFailed: "دسترسی به اسناد تأیید نشد. دوباره تلاش کنید؛ ورود شما معتبر است.", verificationFailed: "بررسی اعتبار ورود انجام نشد. اتصال را بررسی و دوباره تلاش کنید.", title: "پیش‌فاکتورهای من", subtitle: "آرشیو پیش‌فاکتورهای صادرشده از سبد خرید، با دریافت مجدد PDF", issue: "دریافت پیش‌فاکتور", issuing: "در حال صدور…", count: "تعداد پیش‌فاکتورهای صادرشده", latest: "دریافت آخرین PDF", all: "همهٔ پیش‌فاکتورها", rules: "قواعد صدور پیش‌فاکتور", disclaimer: "این سند رسید پرداخت، تضمین قیمت یا رزرو موجودی نیست. هنگام ثبت سفارش، قیمت و موجودی روز دوباره بررسی می‌شوند.", loading: "در حال بارگذاری…", empty: "هنوز پیش‌فاکتوری ندارید", emptyBody: "از سبد خرید خود پیش‌فاکتور دریافت کنید؛ در اینجا ذخیره می‌شود.", cart: "بازگشت به سبد خرید", retry: "تلاش مجدد", date: "تاریخ صدور", number: "شماره سند / شرح", amount: "مبلغ (تومان)", print: "چاپ", next: "بعدی", previous: "قبلی" },
  en: { signIn: "Sign in again", accessFailed: "Document access could not be verified. Please retry; your sign-in is valid.", verificationFailed: "Sign-in verification is unavailable. Check your connection and retry.", title: "My proformas", subtitle: "Saved cart quotations and repeat PDF downloads", issue: "Get proforma", issuing: "Issuing…", count: "Issued proformas", latest: "Download latest PDF", all: "All proformas", rules: "Proforma terms", disclaimer: "This document is not proof of payment, a price guarantee or a stock reservation. Current prices and stock are checked again at checkout.", loading: "Loading…", empty: "No proformas yet", emptyBody: "Request a proforma from your cart to save it here.", cart: "Back to cart", retry: "Retry", date: "Issue date", number: "Document / description", amount: "Amount (Toman)", print: "Print", next: "Next", previous: "Previous" },
};
