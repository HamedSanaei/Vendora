import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { readShippingSettings, saveShippingSettings, shippingReferences, type ShippingSettings, type ShippingReference, type ShippingPackage } from '../api/shippingApi';
import { AdminButton, AdminCheckbox, AdminFeedback, AdminField, AdminPanel, AdminSelect } from './AdminUi';
import { formatMoney } from '../utils/formatters';

/** Extends the existing store-management surface with versioned pricing and measured parcel configuration. */
export function AdminShippingSettings({ locale }: { locale: 'fa' | 'en' }) {
  const fa = locale === 'fa';
  const [draft, setDraft] = useState<ShippingSettings | null>(null), [error, setError] = useState(''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [refs, setRefs] = useState<{cities: ShippingReference[]; methods: ShippingReference[]; boxes: ShippingReference[]}>({ cities: [], methods: [], boxes: [] });
  useEffect(() => { let active = true; readShippingSettings().then(value => { if (active) { setDraft(value); setError(''); } }).catch(() => { if (active) setError(fa ? 'دریافت تنظیمات ارسال انجام نشد.' : 'Unable to load shipping settings.'); }); return () => { active = false; }; }, [attempt, fa]);

  /** Loads carrier catalogs only after an explicit admin request, leaving unrelated settings usable on provider failure. */
  async function loadReferences() {
    setBusy(true); setError('');
    try { const [cities, methods, boxes] = await Promise.all([shippingReferences('cities'), shippingReferences('methods'), shippingReferences('boxes')]); setRefs({cities, methods, boxes}); }
    catch { setError(fa ? 'ارتباط با پستِکس برقرار نشد؛ کلید سرور و دسترسی سرویس را بررسی کنید.' : 'Postex is unavailable. Check server configuration.'); }
    finally { setBusy(false); }
  }

  /** Publishes only after server validation; failed saves preserve the full local draft. */
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return; setBusy(true); setSaved(false); setError('');
    try { setDraft(await saveShippingSettings(draft)); setSaved(true); }
    catch (cause) { const code = axios.isAxiosError(cause) ? cause.response?.data?.code : null;
      setError(code === 'SHIPPING_POLICY_CHANGED' ? (fa ? 'تنظیمات توسط مدیر دیگری تغییر کرده است؛ ابتدا دوباره دریافت کنید.' : 'Settings changed in another session. Reload before saving.') : (fa ? 'ذخیره انجام نشد؛ مبلغ، ابعاد و عدم هم‌پوشانی بازه‌ها را بررسی کنید.' : 'Save failed. Check amount, dimensions and non-overlapping ranges.')); }
    finally { setBusy(false); }
  }

  /** Edits one package without changing other range selections. */
  function changePackage(index: number, key: keyof ShippingPackage, value: number) {
    if (draft) setDraft({...draft, packages: draft.packages.map((row, i) => i === index ? {...row, [key]: value} : row)});
  }

  return <AdminPanel title={fa ? 'ارسال و قیمت‌گذاری' : 'Shipping & retail pricing'} description={fa ? 'قیمت پایه حفظ می‌شود؛ سهم ارسال برای هر واحد محاسبه می‌شود و مشمول تخفیف نیست.' : 'Base prices are preserved. The embedded per-unit shipping amount is not discounted.'}>
    {error && <AdminFeedback tone="error">{error}<AdminButton onClick={() => setAttempt(value => value + 1)} variant="secondary">{fa ? 'دریافت مجدد' : 'Reload'}</AdminButton></AdminFeedback>}
    {!draft ? <p role="status">{fa ? 'در حال دریافت تنظیمات…' : 'Loading settings…'}</p> : <form className="admin-form" onSubmit={submit}><fieldset disabled={busy} className="accounting-fieldset">
      <AdminCheckbox label={fa ? 'ارسال رایگان با احتساب هزینه در قیمت هر واحد کالا' : 'Include shipping in every product unit price'} checked={draft.policy.includedInPrice} onChange={event => { setSaved(false); setDraft({...draft, policy: {...draft.policy, includedInPrice: event.target.checked}}); }} />
      <AdminField label={fa ? 'سهم ثابت هر واحد (تومان)' : 'Embedded amount per unit (Toman)'} type="number" min={0} max={1000000000} step={1} required value={draft.policy.unitAmount} onChange={event => setDraft({...draft, policy: {...draft.policy, unitAmount: Number(event.target.value)}})} />
      <AdminFeedback>{fa ? `نمونه: کالای ۱٬۰۰۰٬۰۰۰ تومانی ← ${formatMoney(1000000 + (draft.policy.includedInPrice ? draft.policy.unitAmount : 0), locale)}` : `Example: ${formatMoney(1000000 + (draft.policy.includedInPrice ? draft.policy.unitAmount : 0), locale)}`}</AdminFeedback>
      <p>{fa ? 'تا ۱۰ عدد: پست یا تیپاکس؛ از ۱۱ عدد: باربری هم قابل انتخاب است. در حالت خاموش، پست استعلامی و تیپاکس و باربری پس‌کرایه هستند.' : 'Post/Tipax for all baskets; freight is also available above ten units. When disabled, post uses a quote and Tipax/freight collect payment on delivery.'}</p>
      <AdminFeedback tone={draft.postexConfigured ? 'success' : 'warning'}>{draft.postexConfigured ? (fa ? 'کلید پستِکس در تنظیمات سرور موجود است؛ اتصال زنده با دریافت فهرست‌ها بررسی می‌شود.' : 'Server key configured; load catalogs to check connectivity.') : (fa ? 'کلید پستِکس تنظیم نشده است. کلید فقط در Shipping__Postex__ApiKey سرور قرار می‌گیرد. ارسال رایگان نیازمند استعلام نیست.' : 'Set Shipping__Postex__ApiKey on the server. Included shipping needs no rate request.')}</AdminFeedback>
      <AdminButton disabled={!draft.postexConfigured} onClick={() => void loadReferences()} variant="secondary">{fa ? 'دریافت شهرها، سرویس پست و بسته‌ها' : 'Load cities, postal services & boxes'}</AdminButton>
      <div className="admin-form-grid">
        <AdminSelect label={fa ? 'شهر مبدأ پستِکس' : 'Origin city'} value={draft.policy.originCityCode} onChange={event => setDraft({...draft, policy: {...draft.policy, originCityCode: event.target.value}})}><option value="">{fa ? 'انتخاب شهر' : 'Select city'}</option>{draft.policy.originCityCode && !refs.cities.length && <option value={draft.policy.originCityCode}>{draft.policy.originCityCode}</option>}{refs.cities.map(city => <option key={city.code} value={city.code}>{city.province} ـ {city.name}</option>)}</AdminSelect>
        <AdminSelect label={fa ? 'سرویس شرکت ملی پست' : 'Iran Post service'} value={draft.policy.serviceType} onChange={event => setDraft({...draft, policy: {...draft.policy, courierCode: 'IR_POST', serviceType: event.target.value, paymentType: 'SENDER'}})}><option value="">{fa ? 'انتخاب سرویس' : 'Select service'}</option>{draft.policy.serviceType && !refs.methods.length && <option value={draft.policy.serviceType}>{draft.policy.serviceType}</option>}{refs.methods.map(method => <option key={method.code} value={method.code}>{method.name}</option>)}</AdminSelect>
        <AdminSelect label={fa ? 'تحویل بسته به شرکت حمل' : 'Carrier handoff'} value={draft.policy.collectionType} onChange={event => setDraft({...draft, policy: {...draft.policy, collectionType: event.target.value}})}><option value="courier_drop_off">{fa ? 'تحویل به دفتر شرکت پست' : 'Drop off at carrier'}</option><option value="postex_drop_off">{fa ? 'تحویل به دفتر پستِکس' : 'Drop off at Postex'}</option><option value="pick_up">{fa ? 'جمع‌آوری توسط پستِکس' : 'Pickup by Postex'}</option></AdminSelect>
        {(['originLatitude', 'originLongitude'] as const).map((key, index) => <AdminField key={key} label={fa ? (index === 0 ? 'عرض جغرافیایی مبدأ' : 'طول جغرافیایی مبدأ') : key} type="number" step="any" value={draft.policy[key] ?? ''} onChange={event => setDraft({...draft, policy: {...draft.policy, [key]: event.target.value === '' ? null : Number(event.target.value)}})} />)}
      </div>
      <h3>{fa ? 'الگوهای بسته‌بندی بر اساس تعداد واحد' : 'Parcel profiles by total unit count'}</h3>
      {draft.packages.map((row, index) => <div key={index} className="accounting-line">
        {([['minQuantity','از تعداد'],['maxQuantity','تا تعداد'],['emptyWeightGrams','وزن بسته خالی (گرم)'],['lengthCm','طول (سانتی‌متر)'],['widthCm','عرض (سانتی‌متر)'],['heightCm','ارتفاع (سانتی‌متر)']] as const).map(([key,label]) => <AdminField key={key} label={fa ? label : key} type="number" min={key === 'emptyWeightGrams' ? 0 : 1} step={1} required value={key === 'emptyWeightGrams' ? row[key] : row[key] || ''} onChange={event => changePackage(index, key, Number(event.target.value))} />)}
        <AdminSelect label={fa ? 'نوع بسته پستِکس' : 'Carrier box'} value={row.boxTypeId} onChange={event => changePackage(index, 'boxTypeId', Number(event.target.value))}><option value={row.boxTypeId}>{row.boxTypeId || (fa ? 'ابعاد ثبت‌شده' : 'Custom dimensions')}</option>{refs.boxes.map(box => <option key={box.code} value={box.code}>{box.name}</option>)}</AdminSelect>
        <AdminButton onClick={() => setDraft({...draft, packages: draft.packages.filter((_, i) => i !== index)})} variant="danger">{fa ? 'حذف الگو' : 'Remove profile'}</AdminButton>
      </div>)}
      <AdminButton onClick={() => setDraft({...draft, packages: [...draft.packages, {minQuantity: 1, maxQuantity: 10, emptyWeightGrams: 0, lengthCm: 0, widthCm: 0, heightCm: 0, boxTypeId: 0}]})} variant="secondary">{fa ? 'افزودن الگوی بسته' : 'Add parcel profile'}</AdminButton>
      {saved && <AdminFeedback tone="success">{fa ? 'سیاست ارسال ذخیره شد؛ قیمت پایهٔ محصولات تغییر نکرد.' : 'Shipping policy saved; base prices are unchanged.'}</AdminFeedback>}
      <AdminButton type="submit" variant="brass">{busy ? (fa ? 'در حال ذخیره…' : 'Saving…') : (fa ? 'ذخیره سیاست ارسال' : 'Save shipping policy')}</AdminButton>
    </fieldset></form>}
  </AdminPanel>;
}
