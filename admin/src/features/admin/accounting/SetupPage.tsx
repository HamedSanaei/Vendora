import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminCheckbox, AdminConfirmDialog, AdminEmptyState, AdminFeedback, AdminField, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { normalizeAdminLocale } from '../i18n';
import { useAccountingData, useAccountingWrite } from './hooks';
import type { HistoricalPayment, SetupPreview } from './model';
import { number } from './format';

/** Presents a read-only cutover preview before any explicitly confirmed setup or historical adoption. */
export function SetupPage() {
  const locale = normalizeAdminLocale(useParams().locale), fa = locale === 'fa';
  const preview = useAccountingData<SetupPreview>('/setup/preview', fa), historical = useAccountingData<HistoricalPayment[]>('/setup/historical-payments', fa), write = useAccountingWrite(fa);
  const [selected, setSelected] = useState<string[]>([]), [confirmation, setConfirmation] = useState(''), [confirming, setConfirming] = useState(false);
  const [reconcile, setReconcile] = useState<HistoricalPayment | null>(null), [historicalConfirmation, setHistoricalConfirmation] = useState('');
  const data = preview.data;
  if (preview.error) return <AdminFeedback tone="error">{preview.error}<AdminButton onClick={preview.reload}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>;
  if (!data) return <LoadingState label={fa ? 'در حال بررسی اطلاعات…' : 'Inspecting data…'} />;
  const blocked = data.openOrderIds.length > 0 || data.activeReservations > 0;
  return <>
    <AdminFeedback tone="warning">{fa ? 'این صفحه فقط پیش‌نمایش است. تا تأیید صریح مدیر هیچ موجودی تغییر نمی‌کند. فقط کالاهایی را انتخاب کنید که موجودی آن‌ها واقعاً نمونه و غیرواقعی است.' : 'Preview only. No stock changes occur without explicit confirmation. Select only genuinely non-real demonstration stock.'}</AdminFeedback>
    {write.error && <AdminFeedback tone="error">{write.error}</AdminFeedback>}
    <AdminPanel title={fa ? 'پیش‌نمایش راه‌اندازی' : 'Initialization preview'}><div className="accounting-body"><p>{fa ? 'سفارش‌های باز / رزروهای فعال: ' : 'Open orders / active reservations: '}{data.openOrderIds.length} / {data.activeReservations}</p>{data.activated ? <AdminFeedback tone="success">{fa ? 'حسابداری قبلاً فعال شده است؛ راه‌اندازی دوباره اجرا نمی‌شود.' : 'Accounting is already active; setup cannot run again.'}</AdminFeedback> : <>
      {data.products.map(p => <div className="accounting-setup-row" key={p.id}><AdminCheckbox label={`${p.productCode} · ${p.title} · ${number(p.stockQuantity, locale)} → 0`} checked={selected.includes(p.id)} disabled={write.busy} onChange={e => setSelected(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id))} /></div>)}
      <AdminField label={fa ? 'برای تأیید، عبارت زیر را عیناً وارد کنید: ZERO_SELECTED_DEMO_STOCK' : 'Type exactly: ZERO_SELECTED_DEMO_STOCK'} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <AdminButton variant="brass" disabled={blocked || write.busy || confirmation !== 'ZERO_SELECTED_DEMO_STOCK' || data.products.some(p => p.stockQuantity > 0 && !selected.includes(p.id))} onClick={() => setConfirming(true)}>{fa ? 'تأیید و فعال‌سازی' : 'Confirm and activate'}</AdminButton>
      {blocked && <AdminFeedback tone="error">{fa ? 'سفارش یا رزرو باز مانع فعال‌سازی است. هیچ سابقه‌ای حذف نمی‌شود.' : 'Open orders/reservations block initialization. No history will be deleted.'}</AdminFeedback>}
    </>}</div></AdminPanel>
    {historical.error && <AdminFeedback tone="error">{historical.error}</AdminFeedback>}
    <AdminPanel title={fa ? 'تطبیق پرداخت‌های تاریخی' : 'Historical payment reconciliation'} description={fa ? 'پرچم پرداخت یا دادهٔ نمونه، شاهد تأیید واقعی درگاه نیست.' : 'A payment flag or demo data is not server verification evidence.'}><div className="accounting-body accounting-stack">{historical.loading && <LoadingState label={fa ? 'در حال بررسی پرداخت‌های تاریخی…' : 'Loading historical payments…'} />}{historical.data?.length === 0 && <AdminEmptyState title={fa ? 'پرداخت تاریخی نیازمند تطبیق وجود ندارد' : 'No historical payments to reconcile'} description={fa ? 'هیچ سند یا دریافت ساختگی ایجاد نمی‌شود.' : 'No fabricated document or receipt is created.'} />}{historical.data?.map(payment => <div className="accounting-summary" key={payment.paymentId}><span>{payment.orderNumber} · {number(payment.amountToman, locale)} · {payment.eligible ? (fa ? 'شاهد سروری موجود است' : 'Evidence available') : (fa ? 'شواهد کافی نیست' : 'Insufficient evidence')}</span><AdminButton variant="secondary" disabled={!payment.eligible || !data.activated || write.busy} onClick={() => { setReconcile(payment); setHistoricalConfirmation(''); }}>{fa ? 'بررسی و تطبیق' : 'Review & reconcile'}</AdminButton></div>)}</div></AdminPanel>
    {reconcile && <AdminPanel title={fa ? 'تأیید تطبیق سند تاریخی' : 'Confirm historical reconciliation'}><div className="accounting-body"><AdminField label="RECONCILE_VERIFIED_PAYMENT" value={historicalConfirmation} onChange={e => setHistoricalConfirmation(e.target.value)} /><AdminButton disabled={write.busy || historicalConfirmation !== 'RECONCILE_VERIFIED_PAYMENT'} variant="brass" onClick={() => void write.run(`/setup/historical-payments/${reconcile.paymentId}/reconcile`, { previewFingerprint: reconcile.fingerprint, confirmation: historicalConfirmation }, () => { setReconcile(null); historical.reload(); })}>{fa ? 'ثبت تطبیق پس از بررسی' : 'Reconcile reviewed payment'}</AdminButton><AdminButton variant="ghost" onClick={() => setReconcile(null)}>{fa ? 'انصراف' : 'Cancel'}</AdminButton></div></AdminPanel>}
    <AdminConfirmDialog isOpen={confirming} isPending={write.busy} title={fa ? 'صفرکردن موجودی نمونه و فعال‌سازی' : 'Reset demo quantities & activate'} description={fa ? 'تعداد کالاهای انتخاب‌شده صفر خواهد شد. شناسه‌ها، کالاها و سوابق حذف نمی‌شوند. این عملیات فقط برای موجودی نمونهٔ تأییدشده است.' : 'Selected quantities become zero. Products, IDs and history remain. This is only for confirmed demonstration stock.'} cancelLabel={fa ? 'انصراف' : 'Cancel'} confirmLabel={fa ? 'تأیید نهایی' : 'Confirm'} onCancel={() => setConfirming(false)} onConfirm={() => void write.run('/setup/activate', { productIds: selected, previewFingerprint: data.fingerprint, confirmation }, () => { setConfirming(false); preview.reload(); })} />
  </>;
}
