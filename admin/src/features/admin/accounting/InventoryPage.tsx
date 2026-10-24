import { useEffect, useState, type FormEvent } from 'react';
import { AccountingSummaryCards } from './SummaryCards';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminField, AdminPanel, AdminSelect, AdminTextarea } from '../components/AdminUi';
import { getAdminProducts } from '../api/adminApi';
import type { AdminProduct } from '../types';
import { accountingError } from './api';
import { normalizeAdminLocale } from '../i18n';
import { AccountingTable } from './AccountingUi';
import { date, number } from './format';
import { useAccountingQuery } from './hooks';
import { useAccountingData, useAccountingWrite } from './hooks';
import { kindLabels, partyName, type Inventory, type Movement, type Paged, type PriceHistory } from './model';

/** Shows physical/reserved/available balances and immutable stock events using the existing responsive table. */
export function InventoryPage() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const productId = query.params.get('product') ?? '';
  const balances = useAccountingData<Paged<Inventory>>(`/inventory?page=${query.page}${productId ? `&productId=${productId}` : ''}`, fa);
  const movements = useAccountingData<Paged<Movement>>(`/movements?page=${query.page}${productId ? `&productId=${productId}` : ''}`, fa);
  const [adjustment, setAdjustment] = useState<Inventory | null>(null);
  const kinds = fa ? ['خرید', 'فروش', 'برگشت خرید', 'برگشت فروش', 'تعدیل ورود', 'تعدیل خروج', 'رزرو', 'آزادسازی', 'افتتاحیه نمونه', 'صفرکردن نمونه'] : ['Purchase', 'Sale', 'Purchase return', 'Sales return', 'Adjustment in', 'Adjustment out', 'Reserve', 'Release', 'Demo opening', 'Demo reset'];
  return <><AccountingSummaryCards family="inventory" /><AdminPanel title={fa ? 'موجودی کالاها' : 'Inventory balances'} description={fa ? 'موجودی قابل فروش = دفتری − رزرو' : 'Available = on-hand − reserved'}>
    {productId && <AdminButton onClick={() => query.set('product', '')} variant="ghost">{fa ? 'نمایش همه کالاها' : 'All products'}</AdminButton>}
    <AccountingTable {...balances} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.productId} columns={[
      { label: fa ? 'کالا / کد' : 'Product / code', render: row => `${row.title} · ${row.productCode}` },
      { label: fa ? 'دفتری / رزرو / آزاد' : 'On-hand / reserved / available', render: row => [row.onHand, row.reserved, row.available].map(x => number(x, locale)).join(' / ') },
      { label: fa ? 'میانگین / ارزش (تومان)' : 'Average / value (Toman)', render: row => [row.averageCostToman, row.valueToman].map(x => number(x, locale)).join(' / ') },
      { label: fa ? 'عملیات' : 'Actions', render: row => <div className="accounting-actions"><AdminButton variant="secondary" onClick={() => query.set('product', row.productId)}>{fa ? 'گردش' : 'Movements'}</AdminButton><AdminButton variant="brass" onClick={() => setAdjustment(row)}>{fa ? 'تعدیل' : 'Adjust'}</AdminButton></div> },
    ]} />
  </AdminPanel>{adjustment && <StockAdjustment key={adjustment.productId + adjustment.version} balance={adjustment} close={() => setAdjustment(null)} done={() => { setAdjustment(null); balances.reload(); movements.reload(); }} />}
    <AdminPanel title={fa ? 'دفتر گردش موجودی' : 'Immutable stock movements'}><AccountingTable {...movements} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.id} columns={[
      { label: fa ? 'تاریخ' : 'Date', render: row => date(row.postedAtUtc, locale) },
      { label: fa ? 'نوع رویداد' : 'Event', render: row => kinds[row.kind] ?? row.kind },
      { label: fa ? 'تغییر تعداد / رزرو' : 'Quantity / reserved delta', render: row => `${number(row.quantityDelta, locale)} / ${number(row.reservedDelta, locale)}` },
      { label: fa ? 'تغییر ارزش (تومان)' : 'Value delta (Toman)', render: row => number(row.valueDelta, locale) },
      { label: fa ? 'مرجع / شرح' : 'Source / reason', render: row => <span className="accounting-reference"><bdi>{row.sourceKey}</bdi><small>{row.reason}</small></span> },
    ]} /></AdminPanel>
    <AdminFeedback>{fa ? 'موجودی مستقیم قابل بازنویسی نیست؛ هر تغییر باید رویداد قابل رهگیری داشته باشد.' : 'Stock cannot be overwritten; every change requires traceable evidence.'}</AdminFeedback>
  </>;
}

/** Posts a reasoned, versioned adjustment; incoming stock requires its actual total cost. */
function StockAdjustment({ balance, close, done }: { balance: Inventory; close: () => void; done: () => void }) {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', write = useAccountingWrite(fa);
  const [delta, setDelta] = useState(0), [cost, setCost] = useState(0), [reason, setReason] = useState('');
  /** Submits an explicit movement, never an editable Product.StockQuantity field. */
  function save(event: FormEvent) { event.preventDefault(); void write.run(`/inventory/${balance.productId}/adjustments`, { version: balance.version, quantityDelta: delta, totalCostToman: delta > 0 ? cost : null, reason }, done); }
  return <AdminPanel title={`${fa ? 'تعدیل موجودی' : 'Stock adjustment'} · ${balance.title}`}><form onSubmit={save}>
    {write.error && <AdminFeedback tone="error">{write.error}</AdminFeedback>}
    <div className="accounting-form-grid"><AdminField required type="number" step="1" min={-balance.available} label={fa ? 'تغییر تعداد (منفی برای خروج)' : 'Quantity delta (negative for issue)'} value={delta} onChange={e => setDelta(Number(e.target.value))} />{delta > 0 && <AdminField required type="number" step="any" min="0" label={fa ? 'بهای واقعی کل ورودی (تومان)' : 'Actual total incoming cost (Toman)'} value={cost} onChange={e => setCost(Number(e.target.value))} />}<AdminTextarea required maxLength={1000} label={fa ? 'دلیل مستند تغییر' : 'Documented reason'} value={reason} onChange={e => setReason(e.target.value)} /><AdminButton type="submit" disabled={write.busy || delta === 0} variant="brass">{fa ? 'ثبت حرکت' : 'Record movement'}</AdminButton><AdminButton onClick={close} variant="secondary">{fa ? 'انصراف' : 'Cancel'}</AdminButton></div>
  </form></AdminPanel>;
}

/** Shows per-invoice purchase/sale history and captured historical costs for an explicitly selected product. */
export function ProductPriceReport() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const id = query.params.get('product') ?? '';
  const [products, setProducts] = useState<AdminProduct[]>([]), [catalogError, setCatalogError] = useState('');
  useEffect(() => { let active = true; getAdminProducts().then(rows => { if (active) setProducts(rows); }).catch(error => { if (active) setCatalogError(accountingError(error, fa)); }); return () => { active = false; }; }, [fa]);
  const resource = useAccountingData<Paged<PriceHistory>>(id ? `/reports/products/${id}/prices?page=${query.page}` : null, fa);
  return <AdminPanel title={fa ? 'تاریخچه قیمت هر کالا در فاکتورها' : 'Per-invoice product price history'}><div className="accounting-body">{catalogError && <AdminFeedback tone="error">{catalogError}</AdminFeedback>}<AdminSelect label={fa ? 'کالا / کد' : 'Product / code'} value={id} onChange={e => query.set('product', e.target.value)}><option value="">{fa ? 'انتخاب کالا' : 'Choose product'}</option>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} · {p.title}</option>)}{id && !products.some(p => p.id === id) && <option value={id}>{fa ? 'کالای انتخاب‌شده در گزارش' : 'Selected report product'}</option>}</AdminSelect></div>{id && <AccountingTable {...resource} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.lineId} columns={[
    { label: fa ? 'سند / تاریخ' : 'Document / date', render: row => `${row.number} · ${date(row.issuedAtUtc, locale)}` },
    { label: fa ? 'نوع / طرف حساب' : 'Type / party', render: row => `${kindLabels[locale][row.kind]} · ${partyName(row.buyerSnapshotJson)}` },
    { label: fa ? 'تعداد' : 'Quantity', render: row => number(row.quantity, locale) },
    { label: fa ? 'قیمت واحد / ارز / نرخ سند' : 'Unit price / currency / rate', render: row => `${number(row.unitPrice, locale)} · ${row.currency === 1 ? 'USD' : fa ? 'تومان' : 'Toman'} / ${number(row.exchangeRate, locale)}` },
    { label: fa ? 'بهای ثبت‌شده (تومان)' : 'Captured cost (Toman)', render: row => row.capturedCostToman === null ? (fa ? 'نامعلوم' : 'Unknown') : number(row.capturedCostToman, locale) },
  ]} />}</AdminPanel>;
}
