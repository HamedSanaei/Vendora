import { useEffect, useRef, useState } from 'react';
import { analyzeSeo, getSeoModels, seoError, suggestSeo } from '../api/seoApi';
import type { SeoAnalysis, SeoDraft, SeoInput, SeoSuggestion } from '../seo/types';
import { AdminButton, AdminFeedback } from './AdminUi';
import { articlePreviewHtml } from '../utils/article-preview';

interface SeoPanelProps { draft: SeoDraft; onChange: (seo: SeoInput) => void; onContentChange: (content: string) => void; disabled?: boolean }

/** Reusable deterministic assessment, SERP preview and opt-in AI review for products and category pages. */
export function SeoPanel({ draft, onChange, onContentChange, disabled }: SeoPanelProps) {
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [pending, setPending] = useState<{value: SeoSuggestion; snapshot: string} | null>(null);
  const [useTitle, setUseTitle] = useState(true);
  const [useDescription, setUseDescription] = useState(true);
  const aiRequest = useRef<AbortController | null>(null);
  const serialized = JSON.stringify(draft);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!JSON.parse(serialized).name.trim()) return;
      setAnalyzing(true);
      void analyzeSeo(JSON.parse(serialized) as SeoDraft, controller.signal).then(value => { setAnalysis(value); setError(''); })
        .catch(reason => { if (!controller.signal.aborted) setError(seoError(reason)); })
        .finally(() => { if (!controller.signal.aborted) setAnalyzing(false); });
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [serialized]);
  useEffect(() => {
    let cancelled = false;
    void getSeoModels().then(value => { if (!cancelled) { setConfigured(value.configured); setModels(value.models); } }).catch(() => { if (!cancelled) setConfigured(false); });
    return () => { cancelled = true; aiRequest.current?.abort(); };
  }, []);

  /** Runs inference only on a deliberate click; the snapshot guards against overwriting newer edits with old suggestions. */
  async function suggest(operation: string): Promise<void> {
    if (busy || disabled) return;
    const controller = new AbortController(); aiRequest.current = controller;
    setBusy(true); setError(''); setPending(null);
    try { const value = await suggestSeo(operation, draft, controller.signal); setPending({value, snapshot: serialized}); setUseTitle(true); setUseDescription(true); }
    catch (reason) { if (!controller.signal.aborted) setError(seoError(reason)); }
    finally { setBusy(false); }
  }

  /** Applies only selected preview fields; callers still need to save the product/category explicitly. */
  function apply(): void {
    if (!pending || pending.snapshot !== serialized || disabled) return;
    if (pending.value.content) onContentChange(pending.value.content);
    else onChange({ ...draft.seo, ...(useTitle && pending.value.title ? {title: pending.value.title} : {}), ...(useDescription && pending.value.description ? {description: pending.value.description} : {}) });
    setPending(null);
  }

  const fields: Array<[keyof SeoInput, string, number]> = [
    ['title', 'عنوان سئو', 250], ['description', 'توضیحات متا', 500], ['focusKeyphrase', 'عبارت هدف اصلی', 150],
    ['relatedKeyphrases', 'عبارت‌های مرتبط (هر عبارت در یک خط)', 1000], ['canonicalUrl', 'آدرس canonical اختیاری', 1000],
    ['socialTitle', 'عنوان شبکه‌های اجتماعی', 250], ['socialDescription', 'توضیح شبکه‌های اجتماعی', 500], ['socialImageUrl', 'آدرس تصویر شبکه‌های اجتماعی', 500]
  ];
  return <section className="admin-seo-panel" aria-label="سئوی محتوا">
    <div className="admin-panel-heading"><h2>سئو و پیش‌نمایش جستجو</h2><strong aria-live="polite">{analysis ? `${analysis.score.toLocaleString('fa-IR')} از ۱۰۰` : 'در انتظار تحلیل'}{analyzing ? ' · در حال تحلیل…' : ''}</strong></div>
    <p className="admin-attribute-help">امتیاز داخلی و راهنمای بهبود است، نه امتیاز گوگل یا تضمین رتبه. تغییرات پس از ذخیرهٔ فرم منتشر می‌شوند.</p>
    <fieldset disabled={disabled} className="admin-attribute-fieldset"><div className="admin-form-grid">
      {fields.map(([key, label, maximum]) => <label key={key}>{label}
        {key === 'description' || key === 'relatedKeyphrases' || key === 'socialDescription' ? <textarea rows={3} maxLength={maximum} value={String(draft.seo[key] ?? '')} onChange={event => onChange({...draft.seo,[key]:event.target.value})} />
          : <input maxLength={maximum} value={String(draft.seo[key] ?? '')} onChange={event => onChange({...draft.seo,[key]:event.target.value})} />}
        <small>{String(draft.seo[key] ?? '').length.toLocaleString('fa-IR')} کاراکتر</small></label>)}
    </div><div className="admin-seo-toggles"><label><input type="checkbox" checked={draft.seo.index} onChange={event => onChange({...draft.seo,index:event.target.checked})} />اجازهٔ ایندکس این صفحه</label>
      <label><input type="checkbox" checked={draft.seo.follow} onChange={event => onChange({...draft.seo,follow:event.target.checked})} />اجازهٔ دنبال‌کردن لینک‌ها</label></div></fieldset>
    <div className="admin-attribute-actions"><AdminButton onClick={() => setMobile(false)} aria-pressed={!mobile} variant="secondary">دسکتاپ</AdminButton><AdminButton onClick={() => setMobile(true)} aria-pressed={mobile} variant="secondary">موبایل</AdminButton></div>
    <div className={`admin-serp-preview ${mobile ? 'admin-serp-mobile' : ''}`}><small>{`…/fa/${draft.kind}/${draft.slug || 'نامک'}`}</small><h3>{analysis?.effectiveTitle || draft.name}</h3><p>{analysis?.effectiveDescription || 'توضیحات این صفحه پس از تکمیل محتوا نمایش داده می‌شود.'}</p></div>
    {analysis && <><details><summary>نتیجهٔ بررسی‌ها و راهنمای اصلاح</summary><ul className="admin-seo-checks">{analysis.checks.map(check => <li key={check.code}><strong>{check.state === 'good' ? '✓' : '⚠'} {check.points}/{check.maximum}</strong> {check.message}</li>)}</ul></details>
      <p className="admin-attribute-help">خوانایی فارسی: {analysis.readability.words.toLocaleString('fa-IR')} واژه، {analysis.readability.longSentences.toLocaleString('fa-IR')} جملهٔ بیشتر از ۲۵ واژه، {analysis.readability.longParagraphs.toLocaleString('fa-IR')} پاراگراف طولانی. این سنجش، Flesch انگلیسی نیست.</p>
      {analysis.technicalWarnings.map(warning => <AdminFeedback key={warning} tone="warning">{warning}</AdminFeedback>)}</>}
    <h3>دستیار اختیاری سئو</h3><p className="admin-attribute-help">فقط با درخواست شما متن عمومی همین فرم ارسال می‌شود. پیشنهادها بدون تأیید، جایگزین یا منتشر نمی‌شوند. حداکثر متن ارسالی ۲۴٬۰۰۰ کاراکتر است.</p>
    {!configured && <AdminFeedback tone="warning">اتصال 9Router هنوز در تنظیمات امن سرور فعال نشده است؛ تحلیل عادی سئو مستقل کار می‌کند.</AdminFeedback>}
    {configured && <p>مدل تنظیم‌شده: {models.join('، ') || 'در حال حاضر قابل دریافت نیست'}</p>}
    <div className="admin-attribute-actions">{[['metadata','پیشنهاد عنوان و متا'],['content','بهبود توضیحات'],['advice','راهنمای اصلاح']].map(([operation,label]) => <AdminButton key={operation} variant="secondary" disabled={!configured || busy || disabled || (draft.content?.length ?? 0) > 24000} onClick={() => void suggest(operation)}>{busy ? 'در حال دریافت پیشنهاد…' : label}</AdminButton>)}</div>
    {error && <AdminFeedback tone="error">{error}</AdminFeedback>}
    {pending && <div className="admin-ai-preview"><h3>پیش‌نمایش پیشنهاد؛ هنوز اعمال نشده است</h3>
      {pending.value.title && <label><input type="checkbox" checked={useTitle} onChange={event => setUseTitle(event.target.checked)} />عنوان: {pending.value.title}</label>}
      {pending.value.description && <label><input type="checkbox" checked={useDescription} onChange={event => setUseDescription(event.target.checked)} />متا: {pending.value.description}</label>}
      {pending.value.content && <div dangerouslySetInnerHTML={{__html:articlePreviewHtml(pending.value.content)}} />}
      <ul>{pending.value.advice.map((item,index) => <li key={index}>{item}</li>)}</ul>
      {pending.snapshot !== serialized && <p role="status">فرم بعد از درخواست تغییر کرده است؛ پیشنهاد تازه دریافت کنید.</p>}
      {(pending.value.title || pending.value.description || pending.value.content) && <AdminButton variant="brass" disabled={disabled || pending.snapshot !== serialized || (!pending.value.content && !useTitle && !useDescription)} onClick={apply}>تأیید و اعمال موارد انتخاب‌شده در فرم</AdminButton>}
      <AdminButton variant="secondary" onClick={() => setPending(null)}>رد پیشنهاد</AdminButton>
    </div>}
  </section>;
}
