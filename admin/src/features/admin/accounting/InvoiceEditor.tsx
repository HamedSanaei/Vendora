import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAdminProducts, getInternalExchangeRate } from '../api/adminApi';
import { AdminButton, AdminCheckbox, AdminConfirmDialog, AdminFeedback, AdminField, AdminPanel, AdminSelect, AdminTextarea } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { adminPath, normalizeAdminLocale, type AdminLocale } from '../i18n';
import type { AdminProduct } from '../types';
import { accountingError } from './api';
import { useAccountingData, useAccountingWrite } from './hooks';
import { kindLabels, partyName, type Draft, type DocumentKind, type Invoice, type Paged, type Party } from './model';
import { number } from './format';

interface DocumentContext { allocatedToman: number; creditedToman: number; outstandingToman: number; returnableLines: Array<{ lineId: string; returnedQuantity: number; remainingQuantity: number }> }

/** Loads the corresponding document or original return source before mounting the stateful form. */
export function InvoiceEditor({ returning = false }: { returning?: boolean }) {
  const { id, locale: localeParam } = useParams();
  const locale = normalizeAdminLocale(localeParam), fa = locale === 'fa';
  const [params] = useSearchParams();
  const sourceId = returning ? params.get('source') : null;
  const resource = useAccountingData<Invoice>(id ? `/documents/${id}` : sourceId ? `/documents/${sourceId}` : null, fa);
  const savedReturnSource = !returning && resource.data?.status === 0 && (resource.data.kind === 3 || resource.data.kind === 4) ? resource.data.originalDocumentId : null;
  const savedSource = useAccountingData<Invoice>(savedReturnSource ? `/documents/${savedReturnSource}` : null, fa);
  const contextId = sourceId ?? savedReturnSource ?? id;
  const context = useAccountingData<DocumentContext>(contextId ? `/documents/${contextId}/context` : null, fa);
  if (resource.error) return <AdminFeedback tone="error">{resource.error}<AdminButton onClick={resource.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if (context.error) return <AdminFeedback tone="error">{context.error}<AdminButton onClick={context.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if (savedSource.error) return <AdminFeedback tone="error">{savedSource.error}<AdminButton onClick={savedSource.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if ((id || sourceId) && !resource.data) return <LoadingState label={fa ? 'در حال بارگذاری سند…' : 'Loading document…'} />;
  if (returning && !sourceId) return <AdminFeedback tone="warning">{fa ? 'سند قطعی خرید یا فروش را باز کنید و «ثبت برگشت» را انتخاب کنید.' : 'Open a posted purchase/sale and choose Create return.'}</AdminFeedback>;
  if ((returning || savedReturnSource) && (!context.data || (savedReturnSource && !savedSource.data))) return <LoadingState label={fa ? 'در حال بارگذاری سند اصلی…' : 'Loading original document…'} />;
  // A return and its source share an ID but must never share local form state.
  return <InvoiceForm key={`${returning ? 'return' : 'document'}-${id ?? sourceId ?? `new-${params.get('kind') ?? 0}`}-${resource.data?.version ?? 0}`} locale={locale} original={returning ? resource.data : savedSource.data} existing={returning ? undefined : resource.data} context={context.data} reload={resource.reload} initialKind={Math.min(2, Math.max(0, Number(params.get('kind')) || 0)) as DocumentKind} />;
}

/** Edits drafts only; posting/voiding require explicit confirmation and server version/idempotency checks. */
function InvoiceForm({ locale, existing, original, context, reload, initialKind }: { locale: AdminLocale; existing?: Invoice; original?: Invoice; context?: DocumentContext; reload: () => void; initialKind: DocumentKind }) {
  const fa = locale === 'fa', navigate = useNavigate();
  const write = useAccountingWrite(fa);
  const [draft, setDraft] = useState<Draft>(() => existing ? { ...existing, originalDocumentId: existing.originalDocumentId } : {
    id: null, version: 0, kind: original ? (original.kind === 0 ? 3 : 4) : initialKind,
    counterpartyId: original?.counterpartyId ?? '', currency: original?.currency ?? 0, exchangeRate: original?.exchangeRate ?? 1,
    issuedAtUtc: new Date().toISOString(), freight: 0, purchaseTaxRecoverable: original?.purchaseTaxRecoverable ?? false,
    notes: '', originalDocumentId: original?.id ?? null,
    lines: original ? original.lines.filter(l => (context?.returnableLines.find(x => x.lineId === l.id)?.remainingQuantity ?? 0) > 0).map(l => ({ productId: l.productId, quantity: 0, unitPrice: l.unitPrice, discount: 0, tax: 0, originalLineId: l.id })) : [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, originalLineId: null }],
  });
  const [dirty, setDirty] = useState(false), [partySearch, setPartySearch] = useState('');
  const [products, setProducts] = useState<AdminProduct[]>([]), [catalogError, setCatalogError] = useState('');
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<'post' | 'void-draft' | null>(null);
  const parties = useAccountingData<Paged<Party>>(`/counterparties?search=${encodeURIComponent(partySearch)}`, fa);
  const readOnly = Boolean(existing && existing.status !== 0);
  useEffect(() => { let active = true; getAdminProducts().then(rows => { if (active) setProducts(rows); }).catch(error => { if (active) setCatalogError(accountingError(error, fa)); }); return () => { active = false; }; }, [fa]);
  useEffect(() => { let active = true; getInternalExchangeRate().then(rate => { if (active) setSuggestedRate(rate.tomanPerUsdt); }).catch(() => { /* A missing cached rate never fabricates a financial rate. */ }); return () => { active = false; }; }, []);
  /** Keeps all user-entered data local until an explicit Save request. */
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(old => ({ ...old, [key]: value })); setDirty(true); }
  /** Applies one line edit, preserving the original return reference and other independent line snapshots. */
  function line(index: number, patch: Partial<Draft['lines'][number]>) { change('lines', draft.lines.map((value, i) => i === index ? { ...value, ...patch } : value)); }
  /** Saves a complete draft, leaving posting as a separate operation. */
  function save(event: FormEvent) { event.preventDefault(); void write.run('/documents', { ...draft, lines: draft.lines.filter(x => x.quantity > 0) }, saved => { if (existing) reload(); else navigate(adminPath(locale, `accounting/documents/${saved}`), { replace: true }); }); }
  const total = draft.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice - l.discount + l.tax, draft.freight) * draft.exchangeRate;
  return <div className="accounting-stack">
    <AdminPanel title={existing ? `${kindLabels[locale][draft.kind]} · ${existing.number}` : fa ? 'ثبت فاکتور جدید' : 'New document'} description={fa ? 'پیش‌نویس اثری بر موجودی یا مانده ندارد. نرخ ارز پس از قطعی‌سازی ثابت می‌ماند.' : 'Drafts have no financial or stock effect. Posted rates are immutable.'}>{null}</AdminPanel>
    {(write.error || parties.error || catalogError) && <AdminFeedback tone="error">{write.error || parties.error || catalogError}</AdminFeedback>}
    {draft.currency === 1 && !readOnly && <AdminFeedback>{fa ? 'نرخ داخلی فقط پیشنهاد است؛ نرخ واقعی و تأییدشدهٔ همین سند را وارد کنید.' : 'The cached rate is only a suggestion; confirm the actual rate for this document.'}</AdminFeedback>}
    {context && readOnly && <AdminFeedback>{fa ? 'تخصیص / اعتبار برگشتی / مانده (تومان): ' : 'Allocated / return credit / outstanding (Toman): '}{[context.allocatedToman, context.creditedToman, context.outstandingToman].map(x => number(x, locale)).join(' / ')}</AdminFeedback>}
    <form className="accounting-stack" onSubmit={save}>
      <fieldset disabled={readOnly || write.busy} className="accounting-fieldset">
        <AdminPanel title={fa ? 'مشخصات فاکتور' : 'Document details'}><div className="accounting-form-grid">
          <AdminSelect label={fa ? 'نوع سند' : 'Document type'} value={draft.kind} disabled={Boolean(original || existing)} onChange={e => change('kind', Number(e.target.value) as DocumentKind)}>{kindLabels[locale].map((label, i) => <option key={label} value={i}>{label}</option>)}</AdminSelect>
          <AdminField label={fa ? 'جست‌وجوی طرف حساب' : 'Search party'} value={partySearch} disabled={Boolean(original)} onChange={e => setPartySearch(e.target.value)} />
          <AdminSelect required label={fa ? 'طرف حساب' : 'Counterparty'} disabled={Boolean(original)} value={draft.counterpartyId} onChange={e => change('counterpartyId', e.target.value)}><option value="">{fa ? 'انتخاب کنید' : 'Choose'}</option>{draft.counterpartyId && !parties.data?.items.some(p => p.id === draft.counterpartyId) && <option value={draft.counterpartyId}>{partyName((original ?? existing)?.buyerSnapshotJson ?? '')}</option>}{parties.data?.items.map(p => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}</AdminSelect>
          <AdminField type="date" required label={fa ? 'تاریخ سند' : 'Document date'} value={draft.issuedAtUtc.slice(0, 10)} onChange={e => { if (e.target.value) change('issuedAtUtc', new Date(`${e.target.value}T12:00:00Z`).toISOString()); }} />
          <AdminSelect label={fa ? 'ارز' : 'Currency'} value={draft.currency} disabled={Boolean(original)} onChange={e => { change('currency', Number(e.target.value) as 0 | 1); change('exchangeRate', Number(e.target.value) === 1 ? suggestedRate ?? 0 : 1); }}><option value={0}>{fa ? 'تومان' : 'Toman'}</option><option value={1}>USD</option></AdminSelect>
          <AdminField label={fa ? 'نرخ تأییدشده (تومان)' : 'Confirmed rate (Toman)'} type="number" min="0.000001" step="any" max="1000000000" required disabled={draft.currency === 0 || Boolean(original)} value={draft.exchangeRate} onChange={e => change('exchangeRate', Number(e.target.value))} />
        </div></AdminPanel>
        <AdminPanel title={fa ? 'ردیف‌های فاکتور' : 'Document lines'}><div className="accounting-line-list">
          {draft.lines.map((item, index) => {
            const source = original?.lines.find(x => x.id === item.originalLineId);
            const remaining = context?.returnableLines.find(x => x.lineId === item.originalLineId)?.remainingQuantity;
            return <div className="accounting-line" key={index}>
              <AdminSelect id={`accounting-line-${index}-product`} required label={fa ? 'کالا / کد' : 'Product / code'} disabled={Boolean(original)} value={item.productId} onChange={e => line(index, { productId: e.target.value })}><option value="">{fa ? 'انتخاب کالا' : 'Choose product'}</option>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} · {p.title}</option>)}{item.productId && !products.some(x => x.id === item.productId) && <option value={item.productId}>{source?.title ?? existing?.lines[index]?.title ?? item.productId}</option>}</AdminSelect>
              <AdminField id={`accounting-line-${index}-quantity`} label={original ? (fa ? `برگشت (حداکثر ${remaining ?? 0})` : `Return (max ${remaining ?? 0})`) : fa ? 'تعداد' : 'Quantity'} required type="number" min={original ? 0 : 1} max={original ? remaining : 1000000} value={item.quantity} onChange={e => {
                const quantity = Number(e.target.value);
                line(index, source ? { quantity, discount: source.discount * quantity / source.quantity, tax: source.tax * quantity / source.quantity } : { quantity });
              }} />
              <AdminField id={`accounting-line-${index}-price`} label={fa ? 'قیمت واحد' : 'Unit price'} required disabled={Boolean(original)} type="number" step="any" min="0" value={item.unitPrice} onChange={e => line(index, { unitPrice: Number(e.target.value) })} />
              <AdminField id={`accounting-line-${index}-discount`} label={fa ? 'تخفیف ردیف (مبلغ)' : 'Line discount amount'} disabled={Boolean(original)} type="number" step="any" min="0" value={item.discount} onChange={e => line(index, { discount: Number(e.target.value) })} />
              <AdminField id={`accounting-line-${index}-tax`} label={fa ? 'مالیات ردیف (مبلغ)' : 'Line tax amount'} disabled={Boolean(original)} type="number" step="any" min="0" value={item.tax} onChange={e => line(index, { tax: Number(e.target.value) })} />
              {!original && <AdminButton variant="ghost" disabled={draft.lines.length === 1} onClick={() => change('lines', draft.lines.filter((_, i) => i !== index))}>{fa ? 'حذف ردیف' : 'Remove'}</AdminButton>}
            </div>;
          })}
          {!original && <AdminButton variant="secondary" onClick={() => change('lines', [...draft.lines, { productId: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, originalLineId: null }])}>{fa ? '+ افزودن ردیف' : '+ Add line'}</AdminButton>}
        </div></AdminPanel>
        <AdminPanel title={fa ? 'جمع و توضیحات' : 'Totals & notes'}><div className="accounting-form-grid"><AdminField label={fa ? 'کرایه (ارز سند)' : 'Freight (document currency)'} type="number" min="0" step="any" value={draft.freight} onChange={e => change('freight', Number(e.target.value))} /><AdminCheckbox label={fa ? 'مالیات خرید قابل بازیافت است' : 'Purchase tax is recoverable'} checked={draft.purchaseTaxRecoverable} onChange={e => change('purchaseTaxRecoverable', e.target.checked)} /><AdminTextarea label={fa ? 'توضیحات / علت برگشت' : 'Notes / return reason'} value={draft.notes} maxLength={3000} onChange={e => change('notes', e.target.value)} /></div></AdminPanel>
      </fieldset>
      <AdminPanel><div className="accounting-summary"><strong>{fa ? 'ارزش مبنا: ' : 'Base total: '}{number(total, locale)} {fa ? 'تومان' : 'Toman'}</strong><div className="accounting-actions">
        {!readOnly && <AdminButton type="submit" disabled={write.busy} variant="secondary">{write.busy ? (fa ? 'در حال ذخیره…' : 'Saving…') : fa ? 'ذخیره پیش‌نویس' : 'Save draft'}</AdminButton>}
        {existing?.status === 0 && <><AdminButton variant="brass" disabled={dirty || write.busy} onClick={() => setConfirm('post')}>{fa ? 'قطعی‌سازی' : 'Post'}</AdminButton><AdminButton variant="ghost" disabled={write.busy} onClick={() => setConfirm('void-draft')}>{fa ? 'ابطال پیش‌نویس' : 'Void draft'}</AdminButton></>}
        {readOnly && existing?.status === 1 && (existing.kind === 0 || existing.kind === 1) && <AdminButton to={adminPath(locale, `accounting/returns?source=${existing.id}`)} variant="brass">{fa ? 'ثبت برگشت' : 'Create return'}</AdminButton>}
      </div></div></AdminPanel>
      {dirty && existing && <AdminFeedback>{fa ? 'قبل از قطعی‌سازی، تغییرات را ذخیره کنید.' : 'Save changes before posting.'}</AdminFeedback>}
    </form>
    <AdminFeedback tone="warning">{fa ? 'سند قطعی ویرایش مستقیم ندارد. برگشت فقط پس از دریافت واقعی کالا ثبت می‌شود و بازپرداخت بانکی خودکار نیست. تسویهٔ نقدی یا جزئی را در دریافت و پرداخت ثبت کنید.' : 'Posted documents are immutable. Confirm actual goods receipt before a return; no automatic refund occurs. Record cash or partial settlement separately.'}</AdminFeedback>
    <AdminConfirmDialog isOpen={Boolean(confirm)} isPending={write.busy} title={fa ? 'تأیید عملیات سند' : 'Confirm document operation'} description={fa ? 'قطعی‌سازی اثر مالی و انباری واقعی دارد و قابل ویرایش مستقیم نیست. اطلاعات را بررسی کرده‌ام.' : 'Posting creates real financial/stock effects and cannot be edited directly. I have reviewed the document.'} cancelLabel={fa ? 'انصراف' : 'Cancel'} confirmLabel={fa ? 'تأیید' : 'Confirm'} onCancel={() => setConfirm(null)} onConfirm={() => { if (existing && confirm) void write.run(`/documents/${existing.id}/${confirm}`, { version: existing.version }, () => { setConfirm(null); reload(); }); }} />
  </div>;
}
