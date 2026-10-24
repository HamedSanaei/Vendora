import { useState } from 'react';
import { AccountingSummaryCards } from './SummaryCards';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminChip, AdminFeedback, AdminField, AdminFilterBar, AdminPanel } from '../components/AdminUi';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { accountingError, accountingPdf } from './api';
import { useAccountingData } from './hooks';
import { AccountingTable } from './AccountingUi';
import { date, number, reportDate } from './format';
import { useAccountingQuery } from './hooks';
import { kindLabels, partyName, statusLabels, type DocumentKind, type Invoice, type Paged } from './model';

/** Uses the shared Penpot table/card family for purchases, sales, quotes and the overview's latest documents. */
export function DocumentList({ kind, latest = false }: { kind?: DocumentKind; latest?: boolean }) {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa';
  const query = useAccountingQuery();
  const filters = new URLSearchParams({ page: String(latest ? 1 : query.page), pageSize: latest ? '5' : '25' });
  if (kind !== undefined) filters.set('kind', String(kind));
  if (!latest) for (const name of ['fromUtc', 'toUtc']) { const value = reportDate(query.params.get(name), name === 'toUtc'); if (value) filters.set(name, value); }
  if (!latest && query.params.get('currency')) filters.set('currency', query.params.get('currency')!);
  if (!latest) { if (query.params.get('q')) filters.set('search', query.params.get('q')!); if (query.params.get('status')) filters.set('status', query.params.get('status')!); }
  const resource = useAccountingData<Paged<Invoice>>(`/documents?${filters}`, fa);
  const [pdfError, setPdfError] = useState('');
  const [downloading, setDownloading] = useState(false);
  /** Downloads a safe document snapshot without navigating to unauthenticated URLs. */
  async function pdf(row: Invoice, size: 'A4' | 'A5', print = false) {
    setDownloading(true); setPdfError(''); try { await accountingPdf(row.id, size, print); } catch (error) { setPdfError(accountingError(error, fa)); } finally { setDownloading(false); }
  }
  return <>{!latest && <AccountingSummaryCards family="documents" kind={kind} />}<AdminPanel className={latest ? 'accounting-latest' : undefined} title={latest ? (fa ? 'آخرین اسناد' : 'Latest documents') : kind === undefined ? (fa ? 'اسناد' : 'Documents') : kindLabels[locale][kind]} description={fa ? 'پیش‌نویس بدون اثر مالی یا انباری است؛ اسناد قطعی قابل ویرایش نیستند.' : 'Drafts have no financial or stock effects; posted documents are immutable.'} toolbar={!latest ? <AdminButton to={adminPath(locale, `accounting/documents/new?kind=${kind ?? 0}`)} variant="brass">{fa ? 'سند جدید' : 'New document'}</AdminButton> : undefined}>
    {!latest && <AdminFilterBar searchLabel={fa ? 'جست‌وجوی شماره سند…' : 'Document number…'} searchValue={query.params.get('q') ?? ''} onSearchChange={value => query.set('q', value)}><select aria-label={fa ? 'وضعیت' : 'Status'} value={query.params.get('status') ?? ''} onChange={e => query.set('status', e.target.value)}><option value="">{fa ? 'همه وضعیت‌ها' : 'All statuses'}</option>{statusLabels[locale].map((label, i) => <option key={label} value={i}>{label}</option>)}</select><select aria-label={fa ? 'ارز' : 'Currency'} value={query.params.get('currency') ?? ''} onChange={e => query.set('currency', e.target.value)}><option value="">{fa ? 'همه ارزها' : 'All currencies'}</option><option value="0">{fa ? 'تومان' : 'Toman'}</option><option value="1">USD</option></select></AdminFilterBar>}
    {pdfError && <AdminFeedback tone="error">{pdfError}</AdminFeedback>}
    {!latest && <div className="accounting-form-grid"><AdminField type="date" label={fa ? 'از تاریخ' : 'From date'} value={query.params.get('fromUtc') ?? ''} onChange={e => query.set('fromUtc', e.target.value)} /><AdminField type="date" label={fa ? 'تا تاریخ' : 'To date'} value={query.params.get('toUtc') ?? ''} onChange={e => query.set('toUtc', e.target.value)} /></div>}
    <AccountingTable {...resource} paginate={!latest} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.id} columns={[
      { label: fa ? 'شماره سند' : 'Number', render: row => <AdminButton variant="ghost" to={adminPath(locale, `accounting/documents/${row.id}`)}>{row.number}</AdminButton> },
      { label: fa ? 'طرف حساب' : 'Party', render: row => partyName(row.buyerSnapshotJson) },
      { label: fa ? 'تاریخ' : 'Date', render: row => date(row.issuedAtUtc, locale) },
      ...(latest ? [] : [{ label: fa ? 'ارز / نرخ' : 'Currency / rate', render: (row: Invoice) => row.currency === 1 ? `USD / ${number(row.exchangeRate, locale)}` : (fa ? 'تومان' : 'Toman') }]),
      { label: fa ? 'مبلغ (تومان)' : 'Total (Toman)', render: row => number(row.totalToman, locale) },
      { label: fa ? (latest ? 'وضعیت' : 'وضعیت / عملیات') : 'Status / actions', render: row => <div className="accounting-actions"><AdminChip tone={row.status === 1 ? 'success' : 'neutral'}>{statusLabels[locale][row.status]}</AdminChip>{!latest && row.status === 1 && (row.kind === 1 || row.kind === 2) && <><AdminButton disabled={downloading} variant="secondary" onClick={() => pdf(row, 'A4')}>PDF A4</AdminButton><AdminButton disabled={downloading} variant="secondary" onClick={() => pdf(row, 'A5')}>PDF A5</AdminButton><AdminButton disabled={downloading} variant="ghost" onClick={() => pdf(row, 'A4', true)}>{fa ? 'چاپ' : 'Print'}</AdminButton></>}</div> },
    ]} />
  </AdminPanel></>;
}
