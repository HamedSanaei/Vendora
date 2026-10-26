import { useState } from 'react';
import { shippingLabelsPdf, shippingLabelError } from '../api/shippingLabelsApi';
import { AdminButton, AdminFeedback } from './AdminUi';

/** Reuses the existing action/feedback family for both order detail and the selection toolbar. */
export function OrderLabelActions({ orderIds, locale, bulk = false }: { orderIds: string[]; locale: 'fa' | 'en'; bulk?: boolean }) {
  const fa = locale === 'fa', [busy, setBusy] = useState(false), [error, setError] = useState('');
  /** Captures the current selection; opening a print viewer happens synchronously inside the shared transport. */
  async function run(print: boolean) {
    if (busy) return; setBusy(true); setError('');
    try { await shippingLabelsPdf(orderIds, print); } catch (failure) { setError(shippingLabelError(failure, fa)); } finally { setBusy(false); }
  }
  return <div className="admin-form">
    <div className="admin-page-actions">
      {bulk && <span aria-live="polite">{fa ? `${orderIds.length.toLocaleString('fa-IR')} سفارش انتخاب‌شده؛ حداکثر ۱۰۰` : `${orderIds.length} selected orders; maximum 100`}</span>}
      <AdminButton variant="secondary" disabled={busy || !orderIds.length} onClick={() => void run(false)}>{fa ? (bulk ? 'دانلود گروهی برچسب A5' : 'دانلود برچسب A5') : (bulk ? 'Download A5 labels' : 'Download A5 label')}</AdminButton>
      <AdminButton variant="secondary" disabled={busy || !orderIds.length} onClick={() => void run(true)}>{fa ? (bulk ? 'چاپ گروهی برچسب‌ها' : 'چاپ برچسب') : (bulk ? 'Print labels' : 'Print label')}</AdminButton>
      {busy && <span role="status">{fa ? 'در حال آماده‌سازی PDF…' : 'Preparing PDF…'}</span>}
    </div>
    {error && <AdminFeedback tone="error">{error}</AdminFeedback>}
  </div>;
}
