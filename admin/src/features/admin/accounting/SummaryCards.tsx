import { useParams } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { AdminFeedback } from '../components/AdminUi';
import { normalizeAdminLocale } from '../i18n';
import { useAccountingData, useAccountingQuery } from './hooks';
import { number, reportDate } from './format';
import type { DocumentKind } from './model';

type Summary = Partial<Record<'postedCount' | 'draftCount' | 'postedTotalToman' | 'returnTotalToman' | 'outstandingToman' | 'customerIssuedCount' | 'total' | 'debtors' | 'creditors' | 'linkedUsers' | 'receiptsToman' | 'paymentsToman' | 'unallocatedReceiptsToman' | 'requiresReview' | 'onHand' | 'reserved' | 'available' | 'valueToman', number>>;

/** Applies existing summary cards to real family-specific metrics, avoiding decorative sample amounts. */
export function AccountingSummaryCards({ family, kind }: { family: 'documents' | 'counterparties' | 'settlements' | 'inventory'; kind?: DocumentKind }) {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const filters = new URLSearchParams();
  if (kind !== undefined) filters.set('kind', String(kind));
  for (const name of ['fromUtc', 'toUtc']) { const value = reportDate(query.params.get(name), name === 'toUtc'); if (value) filters.set(name, value); }
  const resource = useAccountingData<Summary>(`/${family}/summary?${filters}`, fa);
  const fields: Array<[keyof Summary, string]> = family === 'documents' ? kind === 2
    ? [['postedCount', fa ? 'صادرشده' : 'Issued'], ['draftCount', fa ? 'پیش‌نویس' : 'Drafts'], ['customerIssuedCount', fa ? 'متصل به مشتری سایت' : 'Linked site customer'], ['postedTotalToman', fa ? 'مجموع مبلغ نمایشی (تومان)' : 'Quotation amounts (Toman)']]
    : [['postedTotalToman', fa ? 'مبلغ اسناد قطعی (تومان)' : 'Posted totals (Toman)'], ['outstandingToman', fa ? 'ماندهٔ فاکتورها' : 'Invoice outstanding'], ['returnTotalToman', fa ? 'برگشتی قطعی' : 'Posted returns'], ['draftCount', fa ? 'پیش‌نویس‌ها' : 'Drafts']]
    : family === 'counterparties' ? [['total', fa ? 'کل طرف حساب‌ها' : 'Counterparties'], ['debtors', fa ? 'دارای بدهی' : 'Debtors'], ['creditors', fa ? 'دارای طلب' : 'Creditors'], ['linkedUsers', fa ? 'متصل به کاربر سایت' : 'Linked users']]
    : family === 'settlements' ? [['receiptsToman', fa ? 'دریافت‌های ثبت‌شده' : 'Recorded receipts'], ['paymentsToman', fa ? 'پرداخت‌های ثبت‌شده' : 'Recorded payments'], ['unallocatedReceiptsToman', fa ? 'دریافت تخصیص‌نیافته' : 'Unallocated receipts'], ['requiresReview', fa ? 'نیازمند بررسی' : 'Needs review']]
    : [['onHand', fa ? 'موجودی دفتری' : 'On-hand'], ['reserved', fa ? 'رزرو' : 'Reserved'], ['available', fa ? 'قابل فروش' : 'Available'], ['valueToman', fa ? 'ارزش موجودی (تومان)' : 'Inventory value (Toman)']];
  if (resource.error) return <AdminFeedback tone="error">{resource.error}</AdminFeedback>;
  return <div className="accounting-metrics" aria-busy={!resource.data}>{fields.map(([key, title]) => <StatCard key={key} title={title} tone="blue" value={resource.data?.[key] === undefined ? '…' : number(resource.data[key]!, locale)} />)}</div>;
}
