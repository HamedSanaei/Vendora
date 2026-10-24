import { useParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminPanel } from '../components/AdminUi';
import { normalizeAdminLocale } from '../i18n';
import { AccountingTable } from './AccountingUi';
import { useAccountingData, useAccountingQuery } from './hooks';
import { number, reportDate } from './format';
import type { Paged } from './model';

interface ProductProfit { productId: string; productCode: number; title: string; netSalesToman: number; knownCostToman: number; knownProfitToman: number; unknownCostLines: number }

/** Shows per-product gross profit from immutable sales/return costs and explicitly labels unknown historical cost. */
export function ProfitReport() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const filters = new URLSearchParams({ page: String(query.page) });
  for (const name of ['fromUtc', 'toUtc']) { const value = reportDate(query.params.get(name), name === 'toUtc'); if (value) filters.set(name, value); }
  const resource = useAccountingData<Paged<ProductProfit>>(`/reports/product-profit?${filters}`, fa);
  const headers = fa ? ['کد', 'کالا', 'فروش خالص', 'بهای معلوم', 'سود با بهای معلوم', 'ردیف با بهای نامعلوم'] : ['Code', 'Product', 'Net sales', 'Known cost', 'Known-cost profit', 'Unknown-cost lines'];
  /** Exports exactly the displayed report page and neutralizes spreadsheet formula prefixes in text cells. */
  function exportPage() {
    if (!resource.data) return;
    const cells = (row: Array<string | number>) => row.map(value => `"${String(value).replace(/^[=+\-@]/, "'$&").replaceAll('"', '""')}"`).join(',');
    const csv = '\uFEFF' + [headers, ...resource.data.items.map(x => [x.productCode, x.title, x.netSalesToman, x.knownCostToman, x.knownProfitToman, x.unknownCostLines])].map(cells).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `product-profit-page-${query.page}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <AdminPanel title={fa ? 'سود ناخالص به تفکیک کالا' : 'Gross profit by product'} toolbar={<AdminButton variant="secondary" disabled={!resource.data?.items.length} onClick={exportPage}>{fa ? 'خروجی CSV این صفحه' : 'Export this page (CSV)'}</AdminButton>}>
    <AccountingTable {...resource} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.productId} columns={[
      { label: headers[1], render: row => `${row.productCode} · ${row.title}` },
      { label: headers[2], render: row => number(row.netSalesToman, locale) },
      { label: headers[3], render: row => number(row.knownCostToman, locale) },
      { label: headers[4], render: row => number(row.knownProfitToman, locale) },
      { label: headers[5], render: row => number(row.unknownCostLines, locale) },
    ]} /><AdminFeedback tone="warning">{fa ? 'ارقام به تومان است. کرایه و مالیات درآمد فروش کالا نیستند. سود بهای معلوم، سود خالص کسب‌وکار نیست؛ ردیف‌های با بهای نامعلوم در آن منظور نشده‌اند.' : 'Toman reporting. Freight/tax are not merchandise revenue. Known-cost gross profit is not net business profit; unknown-cost rows are excluded.'}</AdminFeedback>
  </AdminPanel>;
}
