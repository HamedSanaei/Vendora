import { AdminButton, AdminFeedback, AdminPanel } from '../components/AdminUi';
import { adminPath, type AdminLocale } from '../i18n';
import { useAccountingData } from './hooks';
import type { OrderContext } from './model';
import { date, number } from './format';

/** Adds accounting provenance/reservation context to the existing order page without replacing its workflow. */
export function OrderAccountingContext({ id, locale }: { id: string; locale: AdminLocale }) {
  const fa = locale === 'fa', resource = useAccountingData<OrderContext>(`/orders/${id}/context`, fa), data = resource.data;
  return <AdminPanel title={fa ? 'حسابداری و رزرو موجودی' : 'Accounting & reservation context'}>
    {resource.error ? <AdminFeedback tone="error">{resource.error}<AdminButton onClick={resource.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback> : <div className="admin-detail-list">
      <p>{fa ? 'شاهد تأیید پرداخت سرور: ' : 'Server payment verification evidence: '}{data?.hasServerVerification ? (fa ? 'موجود' : 'Present') : (fa ? 'ثبت نشده' : 'Not recorded')}</p>
      {data?.invoiceId && <AdminButton to={adminPath(locale, `accounting/documents/${data.invoiceId}`)} variant="secondary">{data.invoiceNumber}</AdminButton>}
      {data?.reservations.map(hold => <p key={hold.id}>{number(hold.quantity, locale)} · {(fa ? ['فعال', 'مصرف‌شده', 'آزادشده', 'منقضی'] : ['Active', 'Consumed', 'Released', 'Expired'])[hold.status]} · {date(hold.expiresAtUtc, locale)} <bdi>{new Date(hold.expiresAtUtc).toLocaleTimeString(fa ? 'fa-IR' : 'en-GB')}</bdi></p>)}
      {data?.paymentRequiresReview && <AdminFeedback tone="warning">{fa ? 'پرداخت نیازمند بررسی است؛ رسید واقعی بدون تخصیص نگه‌داری شده است و بازپرداخت ساختگی ثبت نشده.' : 'Payment needs review. Actual money is held unallocated; no refund was fabricated.'}</AdminFeedback>}
    </div>}
    <AdminFeedback>{fa ? 'رزرو سفارش پرداخت‌نشده ۳۰ دقیقه است. تأیید واقعی پرداخت، رزرو را یک بار به خروج و فاکتور تبدیل می‌کند.' : 'Unpaid holds last 30 minutes. Real verification converts a hold into one stock issue and invoice.'}</AdminFeedback>
  </AdminPanel>;
}
