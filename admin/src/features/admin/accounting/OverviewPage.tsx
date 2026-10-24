import { useParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminField, AdminPanel } from '../components/AdminUi';
import { StatCard } from '../components/StatCard';
import { LoadingState } from '../components/LoadingState';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAccountingData } from './hooks';
import { useAccountingQuery } from './hooks';
import { DocumentList } from './DocumentList';
import { number, reportDate } from './format';
import type { Overview } from './model';

/** Renders the accounting overview and reporting totals from genuine posted records, never Penpot sample figures. */
export function AccountingOverview({ reports = false }: { reports?: boolean }) {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa';
  const query = useAccountingQuery();
  const filters = new URLSearchParams();
  for (const name of ['fromUtc', 'toUtc']) { const value = reportDate(query.params.get(name), name === 'toUtc'); if (value) filters.set(name, value); }
  const resource = useAccountingData<Overview>(`/overview?${filters}`, fa);
  const data = resource.data;
  if (resource.error) return <AdminFeedback tone="error">{resource.error}<AdminButton onClick={resource.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if (!data) return <LoadingState label={fa ? 'در حال محاسبه…' : 'Calculating…'} />;
  const metrics: Array<[string, number]> = reports ? [[fa ? 'فروش خالص کالا' : 'Net goods sales', data.salesNetToman], [fa ? 'سود ناخالص با بهای معلوم' : 'Known-cost gross profit', data.grossProfitKnownToman], [fa ? 'ارزش موجودی' : 'Inventory value', data.inventoryValueToman], [fa ? 'تفاوت برگشت خرید' : 'Purchase return variance', data.purchaseReturnDifferenceToman]]
    : [[fa ? 'مطالبات مشتریان' : 'Receivables', data.receivablesToman], [fa ? 'بدهی تأمین‌کنندگان' : 'Payables', data.payablesToman], [fa ? 'ارزش موجودی (تومان)' : 'Inventory value (Toman)', data.inventoryValueToman], [fa ? 'فروش قطعی (تعداد سند)' : 'Posted sales count', data.postedSales]];
  return <>
    {!data.activated && <AdminFeedback tone="warning">{fa ? 'حسابداری هنوز فعال نشده است. پیش‌نویس‌ها و پیش‌فاکتورها اثر انباری ندارند.' : 'Accounting is not initialized. Drafts and quotes do not move stock.'}<AdminButton to={adminPath(locale, 'accounting/setup')} variant="secondary">{fa ? 'پیش‌نمایش راه‌اندازی' : 'Setup preview'}</AdminButton></AdminFeedback>}
    {reports && <AdminPanel title={fa ? 'بازهٔ گزارش' : 'Report period'}><div className="accounting-form-grid"><AdminField label={fa ? 'از تاریخ' : 'From date'} type="date" value={query.params.get('fromUtc') ?? ''} onChange={e => query.set('fromUtc', e.target.value)} /><AdminField label={fa ? 'تا تاریخ' : 'To date'} type="date" value={query.params.get('toUtc') ?? ''} onChange={e => query.set('toUtc', e.target.value)} /></div></AdminPanel>}
    <div className="admin-stat-grid accounting-metrics">{metrics.map(([title, value]) => <StatCard key={title} title={title} value={number(value, locale)} tone="blue" />)}</div>
    <div className="accounting-overview-grid"><DocumentList latest /><AdminPanel className="accounting-settlement" title={fa ? 'وضعیت تسویه' : 'Settlement balances'} description={fa ? 'مانده‌ها از دفتر مالی محاسبه می‌شوند.' : 'Balances are derived from the immutable ledger.'}><dl className="accounting-balances"><div><dt>{fa ? 'مطالبات' : 'Receivables'}</dt><dd>{number(data.receivablesToman, locale)}</dd></div><div><dt>{fa ? 'بدهی‌ها' : 'Payables'}</dt><dd>{number(data.payablesToman, locale)}</dd></div><div><dt>{fa ? 'خرید خالص' : 'Net purchases'}</dt><dd>{number(data.purchasesNetToman, locale)}</dd></div></dl><AdminFeedback tone="warning">{fa ? 'پیش‌نویس و پیش‌فاکتور اثر مالی یا انباری ندارند.' : 'Drafts and proformas have no stock or financial effect.'}</AdminFeedback></AdminPanel></div>
    <AdminPanel className="accounting-mobile-actions" title={fa ? 'عملیات سریع' : 'Quick actions'} description={fa ? 'ثبت بدون بازطراحی صفحات سفارش و کالا' : 'Extend existing orders and products'}><div className="accounting-actions accounting-body"><AdminButton variant="brass" to={adminPath(locale, 'accounting/documents/new')}>{fa ? 'ثبت فاکتور' : 'New invoice'}</AdminButton><AdminButton variant="secondary" to={adminPath(locale, 'accounting/movements')}>{fa ? 'گردش کالا' : 'Stock movements'}</AdminButton></div></AdminPanel>
    {data.unknownCostLines > 0 && <AdminFeedback tone="warning">{fa ? `${number(data.unknownCostLines, locale)} ردیف با بهای تاریخی نامعلوم؛ سود کل قابل اتکا نیست.` : `${data.unknownCostLines} lines have unknown historical costs; total profit is not established.`}</AdminFeedback>}
    <AdminFeedback tone="success">{fa ? 'موجودی قابل فروش = موجودی دفتری − رزرو. هزینهٔ فروش با میانگین موزون در زمان خروج تثبیت می‌شود.' : 'Available = on-hand − reserved. Sale cost is captured at moving weighted average on issue.'}</AdminFeedback>
  </>;
}
