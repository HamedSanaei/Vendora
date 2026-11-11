import axios from "axios";
import { accountToken } from "@/lib/auth/customer-profile";
import { http } from "@/lib/http";
import type { Locale } from "@/lib/vendora/types";

export interface PaymentAvailability { available: boolean; sandbox: boolean }
export interface PaymentResult {
  orderNumber: string;
  amount: number;
  state: "paid" | "review" | "pending" | "failed" | "cancelled";
  canRetry: boolean;
  reference?: string | null;
}

function ownerHeaders() { return { Authorization: `Bearer ${accountToken() ?? ""}` }; }
function orderPath(orderNumber: string) { return `/payments/tabapay/orders/${encodeURIComponent(orderNumber)}`; }

/** Gets only server availability flags. The merchant never reaches the browser. */
export async function readPaymentAvailability(signal?: AbortSignal): Promise<PaymentAvailability> {
  return (await http.get<PaymentAvailability>("/payments/tabapay/availability", { signal })).data;
}

/** Starts or resumes payment for an existing order using the current Vendora session. */
export async function startTabaPay(orderNumber: string, locale: Locale): Promise<string> {
  const { data } = await http.post<{ url: string }>(`${orderPath(orderNumber)}/start`, { locale }, { headers: ownerHeaders(), timeout: 20000 });
  const target = new URL(data.url);
  if (target.origin !== "https://api.tabapay.ir" || target.username || target.password || target.search || target.hash
      || !/^\/(?:sandbox\/)?pay\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(target.pathname))
    throw new Error("Invalid TabaPay destination");
  return target.href;
}

/** Reads the authenticated order's authoritative payment status. */
export async function readTabaPayResult(orderNumber: string, signal?: AbortSignal): Promise<PaymentResult> {
  return (await http.get<PaymentResult>(orderPath(orderNumber), { signal, headers: ownerHeaders() })).data;
}

/** Rechecks an existing attempt via the server when the browser callback could not finish. */
export async function recheckTabaPay(orderNumber: string, locale: Locale): Promise<PaymentResult> {
  return (await http.post<PaymentResult>(`${orderPath(orderNumber)}/check`, { locale }, { headers: ownerHeaders(), timeout: 20000 })).data;
}

/** Maps safe server error codes to customer-facing copy. */
export function paymentErrorMessage(error: unknown, locale: Locale): string {
  const code: unknown = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
  const fa = locale === "fa";
  if (code === "PAYMENT_AMOUNT_OUT_OF_RANGE") return fa ? "مبلغ قابل پرداخت با تاباپی باید بین ۱۰ هزار و ۵۰ میلیون تومان باشد." : "TabaPay supports totals between 10,000 and 50,000,000 toman.";
  if (code === "PAYMENT_START_IN_PROGRESS") return fa ? "درخواست پرداخت در حال پردازش است. چند لحظه دیگر دوباره تلاش کنید." : "Your payment request is in progress. Try again in a moment.";
  if (code === "ORDER_NOT_PAYABLE") return fa ? "این سفارش دیگر قابل پرداخت نیست. وضعیت سفارش را بررسی کنید." : "This order can no longer be paid. Check its current status.";
  if (code === "PAYMENT_NOT_CONFIGURED" || code === "PAYMENT_CALLBACK_DOMAIN_MISMATCH")
    return fa ? "درگاه تاباپی در حال حاضر در دسترس نیست." : "TabaPay is currently unavailable.";
  return fa ? "ارتباط با درگاه کامل نشد. وضعیت سفارش را بررسی کنید و دوباره تلاش کنید." : "The gateway request did not complete. Check the order status and try again.";
}
