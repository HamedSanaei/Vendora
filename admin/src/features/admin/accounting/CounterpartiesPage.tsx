import { useState, type FormEvent } from 'react';
import { AccountingSummaryCards } from './SummaryCards';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminCheckbox, AdminFeedback, AdminField, AdminFilterBar, AdminPanel, AdminSelect, AdminTextarea } from '../components/AdminUi';
import { adminPath, normalizeAdminLocale, type AdminLocale } from '../i18n';
import { AccountingTable } from './AccountingUi';
import { date, number } from './format';
import { useAccountingQuery } from './hooks';
import { useAccountingData, useAccountingWrite } from './hooks';
import type { Ledger, Paged, Party, PartyInput } from './model';

/** Manages real customer/supplier identities using the shared Penpot form/table primitives. */
export function CounterpartiesPage() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const resource = useAccountingData<Paged<Party>>(`/counterparties?page=${query.page}&search=${encodeURIComponent(query.params.get('q') ?? '')}`, fa);
  const [editing, setEditing] = useState<PartyInput | null>(null);
  return <><AccountingSummaryCards family="counterparties" /><AdminPanel title={fa ? 'دفتر طرف حساب‌ها' : 'Counterparties'} toolbar={<AdminButton variant="brass" onClick={() => setEditing({ id: null, version: 0, name: '', phone: '', address: '', role: 2, isLegalEntity: false, registrationNumber: null, notes: '', userId: null })}>{fa ? 'طرف حساب جدید' : 'New counterparty'}</AdminButton>}>
    <AdminFilterBar searchLabel={fa ? 'نام یا شماره تماس…' : 'Name or phone…'} searchValue={query.params.get('q') ?? ''} onSearchChange={value => query.set('q', value)} />
    <AccountingTable {...resource} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.id} columns={[
      { label: fa ? 'نام طرف حساب' : 'Name', render: row => row.name }, { label: fa ? 'نقش' : 'Role', render: row => (fa ? ['مشتری', 'تأمین‌کننده', 'هر دو'] : ['Customer', 'Supplier', 'Both'])[row.role] },
      { label: fa ? 'نوع' : 'Type', render: row => row.isLegalEntity ? (fa ? 'حقوقی' : 'Legal entity') : (fa ? 'حقیقی' : 'Individual') },
      { label: fa ? 'شماره تماس' : 'Phone', render: row => <bdi>{row.phone}</bdi> },
      { label: fa ? 'مانده (تومان)' : 'Balance (Toman)', render: row => number(row.balanceToman ?? 0, locale) },
      { label: fa ? 'جزئیات' : 'Details', render: row => <div className="accounting-actions"><AdminButton variant="ghost" onClick={() => setEditing(row)}>{fa ? 'ویرایش' : 'Edit'}</AdminButton><AdminButton variant="secondary" to={adminPath(locale, `accounting/counterparties/${row.id}`)}>{fa ? 'گردش حساب' : 'Ledger'}</AdminButton></div> },
    ]} />
  </AdminPanel>{editing && <PartyForm key={editing.id ?? 'new'} locale={locale} initial={editing} close={() => setEditing(null)} done={() => { setEditing(null); resource.reload(); }} />}
  <AdminFeedback>{fa ? 'نام و شماره تماس مشابه، حساب‌ها را ادغام نمی‌کند. اتصال به کاربر سایت فقط با شناسهٔ صریح انجام می‌شود.' : 'Similar names/phones never merge identities. Linking a site user requires their explicit identifier.'}</AdminFeedback></>;
}

/** Keeps party edits versioned and does not silently reassign an existing user link. */
function PartyForm({ initial, locale, close, done }: { initial: PartyInput; locale: AdminLocale; close: () => void; done: () => void }) {
  const fa = locale === 'fa', [input, setInput] = useState(initial), write = useAccountingWrite(fa);
  /** Saves only after browser field validation, leaving errors and entered values intact. */
  function save(event: FormEvent) { event.preventDefault(); void write.run('/counterparties', input, done); }
  return <AdminPanel title={fa ? 'مشخصات طرف حساب' : 'Party details'}><form onSubmit={save}>
    {write.error && <AdminFeedback tone="error">{write.error}</AdminFeedback>}
    <fieldset disabled={write.busy} className="accounting-fieldset"><div className="accounting-form-grid">
      <AdminField required maxLength={200} label={fa ? 'نام' : 'Name'} value={input.name} onChange={e => setInput({ ...input, name: e.target.value })} />
      <AdminField maxLength={50} label={fa ? 'تلفن' : 'Phone'} value={input.phone} onChange={e => setInput({ ...input, phone: e.target.value })} />
      <AdminSelect label={fa ? 'نقش' : 'Role'} value={input.role} onChange={e => setInput({ ...input, role: Number(e.target.value) as 0 | 1 | 2 })}>{(fa ? ['مشتری', 'تأمین‌کننده', 'هر دو'] : ['Customer', 'Supplier', 'Both']).map((label, i) => <option key={label} value={i}>{label}</option>)}</AdminSelect>
      <AdminField maxLength={100} label={fa ? 'شناسه / شماره ثبت' : 'Registration number'} value={input.registrationNumber ?? ''} onChange={e => setInput({ ...input, registrationNumber: e.target.value || null })} />
      <AdminField label={fa ? 'شناسهٔ کاربر سایت (اختیاری)' : 'Site user ID (optional)'} disabled={Boolean(initial.id)} value={input.userId ?? ''} onChange={e => setInput({ ...input, userId: e.target.value || null })} />
      <AdminCheckbox label={fa ? 'شخص حقوقی' : 'Legal entity'} checked={input.isLegalEntity} onChange={e => setInput({ ...input, isLegalEntity: e.target.checked })} />
      <AdminTextarea maxLength={2000} label={fa ? 'نشانی' : 'Address'} value={input.address} onChange={e => setInput({ ...input, address: e.target.value })} />
      <AdminTextarea maxLength={3000} label={fa ? 'یادداشت' : 'Notes'} value={input.notes} onChange={e => setInput({ ...input, notes: e.target.value })} />
    </div></fieldset><div className="accounting-actions accounting-body"><AdminButton type="submit" variant="brass" disabled={write.busy}>{fa ? 'ذخیره' : 'Save'}</AdminButton><AdminButton variant="secondary" onClick={close}>{fa ? 'انصراف' : 'Cancel'}</AdminButton></div>
  </form></AdminPanel>;
}

/** Shows signed immutable ledger entries, independently paginated, without rewriting user balances. */
export function CounterpartyLedger() {
  const { id } = useParams(), locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa', query = useAccountingQuery();
  const resource = useAccountingData<Ledger>(`/counterparties/${id}/ledger?page=${query.page}`, fa);
  const party = useAccountingData<Party>(`/counterparties/${id}`, fa);
  return <AdminPanel title={fa ? 'گردش حساب طرف حساب' : 'Counterparty ledger'} toolbar={<AdminButton to={adminPath(locale, `accounting/payments?party=${id}`)} variant="brass">{fa ? 'ثبت دریافت / پرداخت' : 'Receipt / payment'}</AdminButton>}>
    <p className="accounting-body"><strong>{fa ? 'ماندهٔ حساب (تومان): ' : 'Balance (Toman): '}{resource.data ? number(resource.data.balanceToman, locale) : '—'}</strong></p>
    {party.data && <div className="accounting-body"><h2>{party.data.name}</h2><p><bdi>{party.data.phone}</bdi></p><p>{party.data.address}</p>{party.data.isLegalEntity && <p>{fa ? 'شخص حقوقی' : 'Legal entity'} · {party.data.registrationNumber}</p>}</div>}
    <AccountingTable data={resource.data?.entries} loading={resource.loading} error={resource.error} reload={resource.reload} locale={locale} page={query.page} onPage={query.onPage} rowKey={row => row.id} columns={[
      { label: fa ? 'تاریخ' : 'Date', render: row => date(row.postedAtUtc, locale) },
      { label: fa ? 'شرح / مرجع' : 'Reference', render: row => row.documentId ? <AdminButton variant="ghost" to={adminPath(locale, `accounting/documents/${row.documentId}`)}>{fa ? 'سند' : 'Document'}</AdminButton> : (fa ? 'دریافت / پرداخت' : 'Settlement') },
      { label: fa ? 'بدهکار' : 'Debit', render: row => number(Math.max(0, row.amountToman), locale) },
      { label: fa ? 'بستانکار' : 'Credit', render: row => number(Math.max(0, -row.amountToman), locale) },
    ]} />
    <AdminFeedback>{fa ? 'مانده از دفتر مالی محاسبه می‌شود و ویرایش مستقیم ندارد.' : 'The ledger determines the balance; it cannot be overwritten.'}</AdminFeedback>
  </AdminPanel>;
}
