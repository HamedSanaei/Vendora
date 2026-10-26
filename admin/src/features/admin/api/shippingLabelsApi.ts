import axios from 'axios';
import { downloadPdf } from '../../../lib/pdf-download';
import { accountingError } from '../accounting/api';

/** Uses the existing admin session and the same PDF bytes for both download and browser printing. */
export async function shippingLabelsPdf(orderIds: string[], print = false): Promise<void> {
  const ids = [...new Set(orderIds)];
  if (!ids.length || ids.length > 100) throw new Error('LABEL_INVALID_SELECTION');
  await downloadPdf(ids.length === 1
    ? { url: `/api/admin/orders/${encodeURIComponent(ids[0])}/shipping-label/pdf` }
    : { url: '/api/admin/orders/shipping-labels/pdf', method: 'POST', data: { orderIds: ids } },
  ids.length === 1 ? `shipping-label-${ids[0]}-A5.pdf` : 'shipping-labels-A5.pdf', print);
}

/** Maps field-specific validation without exposing addresses or raw renderer failures. */
export function shippingLabelError(error: unknown, fa: boolean): string {
  const body: { code?: string; orderNumber?: string; fields?: string[] } = axios.isAxiosError(error) ? error.response?.data ?? {} : {};
  const code = body.code ?? (error instanceof Error ? error.message : '');
  const fields: Record<string, string> = fa ? { senderName: 'نام فرستنده', senderAddress: 'نشانی فرستنده', supportPhone: 'تلفن پشتیبانی', recipientName: 'نام گیرنده', recipientPhone: 'تلفن گیرنده', province: 'استان', city: 'شهر', streetAddress: 'نشانی', postalCode: 'کد پستی', orderNumber: 'شماره سفارش' } : {};
  const missing = (body.fields ?? []).map(field => fields[field] ?? field).join(fa ? '، ' : ', ');
  if (code === 'LABEL_SENDER_INCOMPLETE') return fa ? `اطلاعات فرستنده در مدیریت فروشگاه کامل نیست: ${missing}` : `Complete sender settings: ${missing}`;
  if (code === 'LABEL_RECIPIENT_INCOMPLETE') return fa ? `اطلاعات ارسال سفارش ${body.orderNumber ?? ''} کامل نیست: ${missing}` : `Incomplete shipping address for ${body.orderNumber ?? ''}: ${missing}`;
  if (code === 'LABEL_CONTENT_TOO_LONG') return fa ? `متن برچسب سفارش ${body.orderNumber ?? ''} با فونت خوانا در یک صفحه A5 جا نمی‌گیرد؛ نشانی ثبت‌شده را بررسی کنید.` : `Order ${body.orderNumber ?? ''} does not fit a readable A5 label. Review its recorded address.`;
  if (code === 'LABEL_ORDER_NOT_FOUND') return fa ? 'یک یا چند سفارش در دسترس نیستند؛ فهرست را تازه کنید.' : 'One or more orders are unavailable. Refresh the list.';
  if (code === 'LABEL_INVALID_SELECTION') return fa ? 'بین ۱ تا ۱۰۰ سفارش انتخاب کنید.' : 'Select 1–100 orders.';
  return accountingError(error, fa);
}
