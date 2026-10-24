import axios from 'axios';
import { httpClient } from '../../../lib/api/httpClient';
import { preparePdfPrintWindow } from '../../../lib/pdf-browser';

const root = '/api/admin/accounting';

/** Reads typed accounting data through the existing authenticated Axios client. */
export async function accountingRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await httpClient.get<T>(root + path, { signal })).data;
}

/** Sends a retry-stable, explicitly keyed accounting operation. */
export async function accountingWrite(path: string, payload: unknown, key: string): Promise<string> {
  return (await httpClient.post<{ id: string }>(root + path, payload, { headers: { 'Idempotency-Key': key } })).data.id;
}

/** Downloads the same authorized PDF used for print; blob errors are decoded before displaying safe feedback. */
export async function accountingPdf(id: string, size: 'A4' | 'A5', print = false): Promise<void> {
  const printWindow = print ? preparePdfPrintWindow() : null;
  try {
    const { data } = await httpClient.get<Blob>(`${root}/documents/${id}/pdf`, { params: { size }, responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(data);
    // The browser's native PDF viewer provides print/printer selection locally; no server printer is involved.
    if (printWindow) printWindow.location.replace(url);
    else { const a = document.createElement('a'); a.href = url; a.download = `${id}-${size}.pdf`; a.click(); }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    printWindow?.close();
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve HTTP failure. */ }
    }
    throw error;
  }
}

/** Maps financial/concurrency errors to actionable localized messages, without leaking exception internals. */
export function accountingError(error: unknown, fa: boolean): string {
  if (error instanceof Error && error.message === 'PDF_POPUP_BLOCKED') return fa ? 'مرورگر پنجرهٔ چاپ را مسدود کرد؛ بازشدن پنجره را مجاز کنید یا PDF را دانلود و از مرورگر چاپ کنید.' : 'Your browser blocked the print window. Allow it or download the PDF and print it from your browser.';
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code: unknown = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
  if (status === 401 || status === 403) return fa ? 'برای این عملیات دسترسی معتبر مدیر لازم است.' : 'Administrator authorization is required.';
  if (typeof code === 'string' && code.startsWith('PDF_')) return fa ? 'تولید PDF در دسترس نیست؛ تنظیم مجوز و فونت سرور را بررسی کنید.' : 'PDF unavailable. Check server license and font configuration.';
  if (code === 'ACCOUNTING_SETUP_REQUIRED') return fa ? 'ابتدا راه‌اندازی کنترل‌شدهٔ حسابداری را تکمیل کنید.' : 'Complete accounting initialization first.';
  if (code === 'ORIGINAL_COST_UNKNOWN') return fa ? 'بهای تاریخی فروش اصلی معلوم نیست؛ برگشت نیازمند بررسی است و بهای ساختگی ثبت نمی‌شود.' : 'Original historical cost is unknown; review is required. No fabricated cost will be posted.';
  if (code === 'RETURN_EXCEEDS_ORIGINAL_QUANTITY') return fa ? 'تعداد برگشت از مقدار باقی‌ماندهٔ فاکتور اصلی بیشتر است.' : 'The return exceeds the remaining original quantity.';
  if (code === 'ALLOCATION_EXCEEDS_INVOICE' || code === 'ALLOCATION_EXCEEDS_SETTLEMENT') return fa ? 'مبلغ تخصیص از ماندهٔ فاکتور یا وجه آزاد بیشتر است.' : 'Allocation exceeds invoice outstanding or available funds.';
  if (code === 'USER_ALREADY_LINKED') return fa ? 'این کاربر قبلاً به طرف حساب دیگری متصل شده است.' : 'This user is already linked to another party.';
  if (code === 'SETUP_PREVIEW_CHANGED') return fa ? 'اطلاعات از زمان پیش‌نمایش تغییر کرده است؛ پیش‌نمایش جدید را بررسی کنید.' : 'Data changed since preview. Review a new preview.';
  if (status === 409) return fa ? 'عملیات انجام نشد؛ موجودی، مانده یا نسخهٔ سند تغییر کرده است. اطلاعات را تازه کنید و دوباره بررسی کنید.' : 'Conflict: stock, balance or document version changed. Reload and review before retrying.';
  return fa ? 'عملیات انجام نشد. مقادیر و اتصال را بررسی کنید؛ اطلاعات واردشده حفظ شده است.' : 'Request failed. Check values and connection; your draft is preserved.';
}
