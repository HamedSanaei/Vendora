import { useState, type FormEvent } from 'react';
import { AccountingSummaryCards } from './SummaryCards';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminField, AdminPanel, AdminSelect } from '../components/AdminUi';
import { normalizeAdminLocale } from '../i18n';
import { useAccountingData, useAccountingWrite } from './hooks';
import { useAccountingQuery } from './hooks';
import { AccountingTable } from './AccountingUi';
import { date, number } from './format';
import type { Invoice, Paged, Party, Settlement } from './model';

/** Records actual money evidence and partial allocations separately from posting invoices. */
export function PaymentsPage() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const resource = useAccountingData<Paged<Settlement>>(`/settlements?page=${query.page}${query.params.get('party') ? `&counterpartyId=${query.params.get('party')}` : ''}`, fa);
  const [partySearch, setPartySearch] = useState('');
  const parties = useAccountingData<Paged<Party>>(`/counterparties?search=${encodeURIComponent(partySearch)}`, fa);
  const [open, setOpen] = useState(false), [allocation, setAllocation] = useState<Settlement | null>(null);
  const [input, setInput] = useState({ counterpartyId: query.params.get('party') ?? '', direction: 0, method: 0, amountToman: 0, reference: '', occurredAtUtc: new Date().toISOString() });
  const write = useAccountingWrite(fa);
  /** Keeps receipt retry keys stable until the server confirms a recorded settlement. */
  function save(event: FormEvent) { event.preventDefault(); void write.run('/settlements', input, () => { setOpen(false); setInput({ ...input, amountToman: 0, reference: '' }); resource.reload(); }); }
  return <><AccountingSummaryCards family="settlements" /><AdminPanel title={fa ? 'دفتر دریافت و پرداخت' : 'Receipts & payments'} toolbar={<AdminButton variant="brass" onClick={() => setOpen(!open)}>{fa ? 'ثبت دریافت / پرداخت' : 'New receipt / payment'}</AdminButton>}>
    {write.error && <AdminFeedback tone="error">{write.error}</AdminFeedback>}
    {open && <form onSubmit={save}><fieldset disabled={write.busy} className="accounting-fieldset"><div className="accounting-form-grid">
      <AdminField label={fa ? 'جست‌وجوی طرف حساب' : 'Search party'} value={partySearch} onChange={e => setPartySearch(e.target.value)} />
      <AdminSelect required label={fa ? 'طرف حساب' : 'Counterparty'} value={input.counterpartyId} onChange={e => setInput({ ...input, counterpartyId: e.target.value })}><option value="">{fa ? 'انتخاب' : 'Choose'}</option>{input.counterpartyId && !parties.data?.items.some(p => p.id === input.counterpartyId) && <option value={input.counterpartyId}>{input.counterpartyId}</option>}{parties.data?.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</AdminSelect>
      <AdminSelect label={fa ? 'عملیات' : 'Direction'} value={input.direction} onChange={e => setInput({ ...input, direction: Number(e.target.value) })}><option value={0}>{fa ? 'دریافت' : 'Receipt'}</option><option value={1}>{fa ? 'پرداخت' : 'Payment'}</option></AdminSelect>
      <AdminSelect label={fa ? 'روش' : 'Method'} value={input.method} onChange={e => setInput({ ...input, method: Number(e.target.value) })}>{(fa ? ['نقد', 'انتقال بانکی', 'کارت'] : ['Cash', 'Bank transfer', 'Card']).map((label, i) => <option value={i} key={label}>{label}</option>)}</AdminSelect>
      <AdminField required min="0.01" step="any" type="number" label={fa ? 'مبلغ (تومان)' : 'Amount (Toman)'} value={input.amountToman} onChange={e => setInput({ ...input, amountToman: Number(e.target.value) })} />
      <AdminField required type="date" label={fa ? 'تاریخ دریافت / پرداخت' : 'Settlement date'} value={input.occurredAtUtc.slice(0, 10)} onChange={e => { if (e.target.value) setInput({ ...input, occurredAtUtc: new Date(`${e.target.value}T12:00:00Z`).toISOString() }); }} />
      <AdminField maxLength={300} label={fa ? 'مرجع واقعی / شرح' : 'Actual reference'} value={input.reference} onChange={e => setInput({ ...input, reference: e.target.value })} />
      <AdminButton type="submit" disabled={write.busy} variant="brass">{fa ? 'ثبت' : 'Record'}</AdminButton>
    </div></fieldset></form>}
    <AccountingTable {...resource} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.id} columns={[
      { label: fa ? 'تاریخ' : 'Date', render: row => date(row.occurredAtUtc, locale) },
      { label: fa ? 'عملیات' : 'Direction', render: row => row.direction === 0 ? (fa ? 'دریافت' : 'Receipt') : (fa ? 'پرداخت' : 'Payment') },
      { label: fa ? 'روش / مرجع' : 'Method / reference', render: row => `${(fa ? ['نقد', 'بانک', 'کارت', 'درگاه تأییدشده'] : ['Cash', 'Bank', 'Card', 'Verified gateway'])[row.method]} / ${row.reference}` },
      { label: fa ? 'مبلغ (تومان)' : 'Amount (Toman)', render: row => number(row.amountToman, locale) },
      { label: fa ? 'تخصیص' : 'Allocation', render: row => <div className="accounting-actions"><span>{number(row.allocatedToman, locale)}</span><AdminButton variant="secondary" disabled={row.requiresReview || row.allocatedToman >= row.amountToman} onClick={() => setAllocation(row)}>{fa ? 'تخصیص' : 'Allocate'}</AdminButton>{row.requiresReview && <span>{fa ? 'نیازمند بررسی پرداخت' : 'Payment needs review'}</span>}</div> },
    ]} />
  </AdminPanel>{allocation && <AllocationForm key={allocation.id} money={allocation} close={() => setAllocation(null)} done={() => { setAllocation(null); resource.reload(); }} />}
  <AdminFeedback tone="warning">{fa ? 'تأیید درگاه از مرورگر قابل ثبت نیست. مرجوعی اعتبار مالی ایجاد می‌کند، نه بازپرداخت بانکی خودکار.' : 'Gateway verification cannot be created by this form. Returns create credit, not automatic bank refunds.'}</AdminFeedback></>;
}

/** Allocates available money only to explicit posted invoices of the same party and direction. */
function AllocationForm({ money, close, done }: { money: Settlement; close: () => void; done: () => void }) {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', write = useAccountingWrite(fa);
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [amount, setAmount] = useState(0);
  const docs = useAccountingData<Paged<Invoice>>(`/documents?kind=${money.direction === 0 ? 1 : 0}&status=1&counterpartyId=${money.counterpartyId}&search=${encodeURIComponent(search)}`, fa);
  const candidates = docs.data?.items.filter(x => x.counterpartyId === money.counterpartyId) ?? [];
  /** Posts one partial allocation; additional invoices can be allocated through subsequent independently keyed operations. */
  function save(event: FormEvent) { event.preventDefault(); void write.run(`/settlements/${money.id}/allocations`, { items: [{ documentId: selected, amountToman: amount }] }, done); }
  return <AdminPanel title={fa ? 'تخصیص دریافت و تسویه جزئی' : 'Partial settlement allocation'}><form onSubmit={save}>
    {write.error && <AdminFeedback tone="error">{write.error}</AdminFeedback>}
    <div className="accounting-form-grid"><AdminField label={fa ? 'شماره فاکتور' : 'Invoice search'} value={search} onChange={e => setSearch(e.target.value)} /><AdminSelect required label={fa ? 'فاکتور قطعی همین طرف حساب' : 'Posted invoice for this party'} value={selected} onChange={e => setSelected(e.target.value)}><option value="">{fa ? 'انتخاب' : 'Choose'}</option>{candidates.map(d => <option key={d.id} value={d.id}>{d.number} / {number(d.totalToman, locale)}</option>)}</AdminSelect><AdminField required type="number" min="0.01" step="any" max={money.amountToman - money.allocatedToman} label={fa ? 'مبلغ تخصیص (تومان)' : 'Allocation (Toman)'} value={amount} onChange={e => setAmount(Number(e.target.value))} /><AdminButton type="submit" variant="brass" disabled={write.busy}>{fa ? 'ثبت تخصیص' : 'Allocate'}</AdminButton><AdminButton onClick={close} variant="secondary">{fa ? 'انصراف' : 'Cancel'}</AdminButton></div>
  </form></AdminPanel>;
}
