import { useEffect, useState } from 'react';
import { readSeedDisplay, saveSeedDisplay, type SeedDisplayState } from '../seed-display';
import { AdminButton, AdminFeedback, AdminPanel } from './AdminUi';

/** Controls one persisted switch for sample data in both admin and storefront, preserving all original records. */
export function AdminSeedVisibility({ locale }: { locale: 'fa' | 'en' }) {
  const fa = locale === 'fa';
  const [state, setState] = useState<SeedDisplayState | null>(null), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0), [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    readSeedDisplay(controller.signal).then(value => { setState(value); setError(''); }).catch(() => { if (!controller.signal.aborted) setError(fa ? 'دریافت تنظیمات انجام نشد.' : 'Could not load this setting.'); });
    return () => controller.abort();
  }, [revision, fa]);

  /** Changes only after explicit activation; failure retains the last confirmed setting. */
  async function toggle() {
    if (!state || pending) return;
    setPending(true); setError(''); setSaved(false);
    try { setState(await saveSeedDisplay(!state.showSeedData)); setSaved(true); }
    catch { setError(fa ? 'ذخیره انجام نشد؛ وضعیت قبلی حفظ شد.' : 'Save failed; the previous setting was kept.'); }
    finally { setPending(false); }
  }

  return <AdminPanel title={fa ? 'نمایش داده‌های نمونه (Seed)' : 'Sample data visibility'} description={fa ? 'این تنظیم برای پنل مدیریت و فروشگاه مشترک است. رکوردها حذف نمی‌شوند و دوباره قابل نمایش‌اند؛ سوابق واقعی خرید و حسابداری حفظ می‌شوند.' : 'Shared across admin and storefront. Records are preserved and can be shown again; real purchase and accounting history remains intact.'}>
    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
      <p role="status">{state ? (state.showSeedData ? (fa ? 'داده‌های نمونه نمایش داده می‌شوند.' : 'Sample data is visible.') : (fa ? 'داده‌های نمونه پنهان هستند.' : 'Sample data is hidden.')) : (fa ? 'در حال دریافت تنظیمات…' : 'Loading setting…')}</p>
      <AdminButton variant={state?.showSeedData ? 'secondary' : 'brass'} disabled={!state || pending} role="switch" aria-checked={state?.showSeedData ?? false} aria-label={fa ? 'نمایش داده‌های نمونه' : 'Show sample data'} onClick={() => void toggle()}>{pending ? (fa ? 'در حال ذخیره…' : 'Saving…') : state?.showSeedData ? (fa ? 'عدم نمایش داده‌های Seed' : 'Hide sample data') : (fa ? 'نمایش داده‌های Seed' : 'Show sample data')}</AdminButton>
    </div>
    {error && <AdminFeedback tone="error">{error}<AdminButton variant="ghost" onClick={() => setRevision(x => x + 1)}>{fa ? 'تلاش مجدد' : 'Retry'}</AdminButton></AdminFeedback>}
    {saved && <AdminFeedback tone="success">{fa ? 'تنظیم ذخیره شد و در درخواست‌های بعدی پنل و فروشگاه اعمال می‌شود.' : 'Saved for subsequent admin and storefront requests.'}</AdminFeedback>}
  </AdminPanel>;
}
