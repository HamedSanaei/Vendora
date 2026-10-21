import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import { getSeoModels, getSeoRedirects, getSeoSettings, saveSeoRedirect, saveSeoSettings, seoError } from '../api/seoApi';
import { AdminButton, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import type { SeoRedirect, SiteSeoSettings } from '../seo/types';
import { useParams } from 'react-router-dom';
import { adminPath, normalizeAdminLocale } from '../i18n';

/** Site-wide launch/indexing gate and safe local redirects; inference secrets are configured exclusively on the server. */
export function AdminSeoPage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const [settings, setSettings] = useState<SiteSeoSettings | null>(null);
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [editing, setEditing] = useState<SeoRedirect>({sourcePath:'',targetPath:'',statusCode:301,isActive:true});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [ai, setAi] = useState<{configured:boolean;models:string[]} | null>(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getSeoSettings(),getSeoRedirects(),getSeoModels()]).then(([value,rows,models]) => {
      if (!cancelled) { setSettings(value); setRedirects(rows); setAi(models); }
    }).catch(reason => {if (!cancelled) setError(seoError(reason));});
    return () => {cancelled = true;};
  }, [revision]);

  /** Saves only an explicit settings/redirect form submission, with visible transport failures. */
  async function submit(event: FormEvent, redirect: boolean): Promise<void> {
    event.preventDefault(); if (busy || !settings) return; setBusy(true); setError('');
    try {
      if (redirect) {await saveSeoRedirect(editing); setRedirects(await getSeoRedirects()); setEditing({sourcePath:'',targetPath:'',statusCode:301,isActive:true});}
      else {await saveSeoSettings(settings); setSettings(await getSeoSettings());}
      toast.success('تنظیمات سئو ذخیره شد.');
    } catch(reason) {setError(seoError(reason));} finally {setBusy(false);}
  }
  return <section className="admin-page"><AdminPageHeader title="سئو و آمادگی انتشار" description="تنظیمات عمومی جستجو، آدرس‌ها و آمادگی ربات‌های فروشگاهی؛ بدون تغییر قیمت یا جریان پرداخت." />
    {error && <AdminFeedback tone="error">{error}<AdminButton onClick={() => setRevision(x => x+1)}>تلاش مجدد</AdminButton></AdminFeedback>}
    {!settings ? <p role="status">در حال بارگیری تنظیمات…</p> : <AdminPanel title="تنظیمات عمومی سایت">
      <form className="admin-form" onSubmit={event => void submit(event,false)}><fieldset disabled={busy} className="admin-attribute-fieldset">
        <div className="admin-form-grid">{([['siteName','نام فروشگاه'],['siteUrl','آدرس اصلی سایت (بدون مسیر)'],['titleTemplate','الگوی عنوان: {title} | {siteName}'],['defaultDescription','توضیح پیش‌فرض سایت'],['logoUrl','آدرس لوگوی عمومی'],['socialProfiles','پروفایل‌های اجتماعی؛ هر آدرس در یک خط']] as const).map(([key,label]) =>
          <label key={key}>{label}<input readOnly={['siteName','logoUrl','socialProfiles'].includes(key)} required={['siteName','siteUrl','titleTemplate'].includes(key)} value={String(settings[key] ?? '')} onChange={event => setSettings({...settings,[key]:event.target.value})} /></label>)}</div>
        <AdminButton to={adminPath(locale, 'online-store')} variant="secondary">{locale === 'fa' ? 'ویرایش نام، لوگو و شبکه‌های اجتماعی در تنظیمات فروشگاه' : 'Edit name, logo and social profiles in store settings'}</AdminButton>
        <label className="admin-seo-check"><input type="checkbox" checked={settings.isIndexingEnabled} onChange={event => setSettings({...settings,isIndexingEnabled:event.target.checked})} />اجازهٔ ایندکس عمومی سایت فارسی پس از آماده‌شدن برای انتشار</label>
        {!settings.isIndexingEnabled && <AdminFeedback tone="warning">حالت پیش‌انتشار فعال است؛ صفحات عمومی فعلاً noindex هستند و نقشهٔ سایت خالی خواهد بود.</AdminFeedback>}
        <AdminButton type="submit" variant="brass">ذخیره تنظیمات عمومی</AdminButton>
      </fieldset></form>
      <p>وضعیت 9Router: {ai?.configured ? `تنظیم شده — ${ai.models.join('، ') || 'مدل قابل دریافت نیست'}` : 'هنوز در سرور تنظیم نشده است'}</p>
      <p className="admin-attribute-help">آدرس سرویس، کلید و مدل فقط از تنظیمات امن سرور خوانده می‌شوند. برای ترب و ایمالز، ثبت و تأیید فروشگاه جداگانه است؛ این بخش فقط زیرساخت فنی خزش را آماده می‌کند.</p>
    </AdminPanel>}
    <AdminPanel title="ریدایرکت‌های داخلی"><p>فقط مسیرهای عمومی فارسی، بدون دامنه، پارامتر یا مسیر حساب کاربری. مثال: /fa/product/نامک-قدیمی</p>
      <form className="admin-form" onSubmit={event => void submit(event,true)}><fieldset disabled={busy} className="admin-attribute-fieldset"><div className="admin-form-grid">
        <label>مسیر مبدأ<input required value={editing.sourcePath} onChange={event => setEditing({...editing,sourcePath:event.target.value})} /></label>
        <label>مسیر مقصد<input required value={editing.targetPath} onChange={event => setEditing({...editing,targetPath:event.target.value})} /></label>
        <label>نوع انتقال<select value={editing.statusCode} onChange={event => setEditing({...editing,statusCode:Number(event.target.value)})}><option value={301}>301 دائمی</option><option value={302}>302 موقت</option></select></label>
      </div><label className="admin-seo-check"><input type="checkbox" checked={editing.isActive} onChange={event => setEditing({...editing,isActive:event.target.checked})} />فعال</label>
        <AdminButton type="submit" variant="brass">ذخیره ریدایرکت</AdminButton><AdminButton variant="secondary" onClick={() => setEditing({sourcePath:'',targetPath:'',statusCode:301,isActive:true})}>فرم جدید</AdminButton>
      </fieldset></form>
      <ul className="admin-attribute-list">{redirects.map(row => <li key={row.id}><span dir="ltr">{row.sourcePath} → {row.targetPath} · {row.statusCode}</span><span>{row.isActive ? 'فعال' : 'غیرفعال'}</span><AdminButton variant="secondary" onClick={() => setEditing(row)}>ویرایش</AdminButton></li>)}</ul>
    </AdminPanel>
  </section>;
}
