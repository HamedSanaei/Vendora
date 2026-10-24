import type { ReactNode } from 'react';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPagination } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import type { AdminLocale } from '../i18n';
import type { Paged } from './model';

export interface AccountingColumn<T> { label: string; render: (row: T) => ReactNode }

/** Reuses the existing responsive table/card styles and empty/loading/error primitives for accounting rows. */
export function AccountingTable<T>({ data, columns, rowKey, locale, page, onPage, loading, error, reload, paginate = true }: {
  data?: Paged<T>; columns: AccountingColumn<T>[]; rowKey: (row: T) => string; locale: AdminLocale; page: number;
  onPage: (page: number) => void; loading?: boolean; error?: string; reload?: () => void; paginate?: boolean;
}) {
  const fa = locale === 'fa';
  if (error) return <AdminFeedback tone="error">{error} <AdminButton onClick={reload} variant="secondary">{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if (loading || !data) return <LoadingState label={fa ? 'در حال بارگذاری…' : 'Loading…'} />;
  if (!data.items.length) return <AdminEmptyState title={fa ? 'اطلاعاتی یافت نشد' : 'No records'} description={fa ? 'با ثبت اطلاعات واقعی، این فهرست تکمیل می‌شود.' : 'Real records will appear here.'} />;
  return <><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(c => <th key={c.label} scope="col">{c.label}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={rowKey(row)}>{columns.map(c => <td key={c.label} data-label={c.label}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>{paginate && <AdminPagination locale={locale} currentPage={page} totalPages={Math.ceil(data.total / data.pageSize)} onPageChange={onPage} label={fa ? 'صفحه‌بندی' : 'Pagination'} />}</>;
}
