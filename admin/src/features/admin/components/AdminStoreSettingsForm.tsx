import axios from 'axios';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { httpClient } from '../../../lib/api/httpClient';
import { storeImageUrl, useAdminStoreSettings, type StoreProfile } from '../storeSettings';
import { storeSettingsCopy } from '../storeSettingsCopy';
import { AdminButton, AdminFeedback, AdminPanel } from './AdminUi';
import '../styles/store-settings.css';

type TextKey = Exclude<keyof StoreProfile, 'enamad' | 'enamadEnabled'>;
const identity: TextKey[] = ['nameFa', 'nameEn', 'homeTitleFa', 'taglineFa', 'taglineEn', 'introFa', 'introEn', 'copyrightFa', 'copyrightEn'];
const contact: TextKey[] = ['phone', 'email', 'addressFa', 'addressEn', 'hoursFa', 'hoursEn', 'socialProfiles'];
const placeholders: Partial<Record<TextKey, string>> = { nameFa: 'وندورا', nameEn: 'VENDORA', taglineFa: 'وندورا', taglineEn: 'Bag Manufacturer', copyrightFa: '© ۱۴۰۵ وندورا · تمامی حقوق محفوظ است.', copyrightEn: '© 2026 Vendora · All rights reserved.' };
export type StoreProfileSection = 'identity' | 'contact' | 'trust';

/** Edits a local draft; only successful explicit submission publishes it to the shared admin branding. */
export function AdminStoreSettingsForm({ locale, section, onSectionChange }: { locale: 'fa' | 'en'; section?: StoreProfileSection; onSectionChange?: (section: StoreProfileSection) => void }) {
  const copy = storeSettingsCopy(locale);
  const { update } = useAdminStoreSettings();
  const [draft, setDraft] = useState<StoreProfile | null>(null);
  const [code, setCode] = useState('');
  const [logo, setLogo] = useState<File>(); const [favicon, setFavicon] = useState<File>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const logoRef = useRef<HTMLInputElement>(null); const faviconRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void httpClient.get<StoreProfile>('/api/admin/store-settings').then(({ data }) => {
      if (!active) return;
      setDraft(data); setCode(badgeCode(data)); setError('');
    }).catch(() => { if (active) setError(copy.failed); });
    return () => { active = false; };
  }, [revision, copy.failed]);

  /** Resets only the displayed scope when tabbed, preserving unrelated drafts and all published settings until save. */
  function resetDefaults(): void {
    if (!section) { setDraft({}); setCode(''); }
    else if (section === 'trust') { setDraft(value => ({...value,enamadEnabled:false,enamad:null})); setCode(''); }
    else setDraft(value => { const next = {...value}; for (const key of section === 'identity' ? [...identity,'logoUrl','faviconUrl'] as TextKey[] : contact) next[key] = null; return next; });
    if (!section || section === 'identity') {
      setLogo(undefined); setFavicon(undefined);
      if (logoRef.current) logoRef.current.value = '';
      if (faviconRef.current) faviconRef.current.value = '';
    }
    setErrors({}); setError(''); setStatus(copy.resetNotice);
  }

  /** Saves multipart settings and keeps the draft intact when validation or transport fails. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!draft || busy) return;
    setBusy(true); setError(''); setStatus(''); setErrors({});
    const form = new FormData(); form.set('settings', JSON.stringify({ profile: draft, enamadCode: code }));
    if (logo) form.set('logo', logo); if (favicon) form.set('favicon', favicon);
    try {
      const { data } = await httpClient.put<StoreProfile>('/api/admin/store-settings', form);
      setDraft(data); setCode(badgeCode(data)); update(data); setLogo(undefined); setFavicon(undefined);
      if (logoRef.current) logoRef.current.value = ''; if (faviconRef.current) faviconRef.current.value = '';
      setStatus(copy.saved);
    } catch (reason) {
      if (axios.isAxiosError<{ errors?: Record<string, string> }>(reason) && reason.response?.data.errors) {
        setErrors(Object.fromEntries(Object.entries(reason.response.data.errors).map(([key, value]) => [key, copy.errors[value] || copy.failed])));
      } else setError(copy.failed);
    } finally { setBusy(false); }
  }

  /** Renders each localized scalar field with accessible server validation feedback. */
  function field(key: TextKey) {
    const multiline = key.startsWith('intro') || key.startsWith('address') || key === 'socialProfiles';
    const props = { id: `settings-${key}`, value: draft?.[key] || '', maxLength: key.startsWith('intro') || key === 'socialProfiles' ? 2000 : key.startsWith('name') || key === 'homeTitleFa' ? 150 : 500,
      dir: key.endsWith('Fa') ? 'rtl' : 'ltr', placeholder: key === 'homeTitleFa' ? draft?.nameFa || 'وندورا' : placeholders[key], 'aria-invalid': Boolean(errors[key]), 'aria-describedby': [errors[key] ? `error-${key}` : '', key === 'homeTitleFa' ? 'settings-home-title-help' : ''].filter(Boolean).join(' ') || undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(value => ({ ...value, [key]: event.target.value })); setStatus(''); } } as const;
    return <label key={key} className="admin-store-setting-field"><span>{copy.labels[key as keyof typeof copy.labels]}</span>{multiline ? <textarea {...props} rows={3} /> : <input {...props} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} />}{key === 'homeTitleFa' && <small id="settings-home-title-help">{copy.homeTitleHelp}</small>}{errors[key] && <small id={`error-${key}`} role="alert">{errors[key]}</small>}</label>;
  }

  const scopeKeys: Record<StoreProfileSection, string[]> = {identity:[...identity,'logo','favicon'],contact,trust:['enamadCode','enamadEnabled']};
  const scopeTitles = {identity:copy.identity,contact:copy.contact,trust:copy.enamad};
  return <AdminPanel title={section ? scopeTitles[section] : copy.title} description={copy.help}>
    {error && <AdminFeedback tone="error">{error}{!draft && <AdminButton onClick={() => setRevision(value => value + 1)}>{copy.retry}</AdminButton>}</AdminFeedback>}
    {!draft ? <p role="status">{copy.loading}</p> : <form className="admin-form admin-store-settings" onSubmit={event => void submit(event)}>
      {section && <p className="admin-attribute-help">{locale === 'fa' ? 'تغییرات هویت، تماس و نماد اعتماد با دکمهٔ ذخیرهٔ این فرم ثبت می‌شوند؛ جابه‌جایی بین تب‌ها پیش‌نویس را حفظ می‌کند.' : 'This form saves branding, contact and trust changes together. Switching tabs preserves your draft.'}</p>}
      {section && (Object.keys(scopeKeys) as StoreProfileSection[]).filter(scope => scope !== section && scopeKeys[scope].some(key => errors[key])).map(scope => <AdminFeedback key={scope} tone="error"><AdminButton variant="secondary" onClick={() => onSectionChange?.(scope)}>{locale === 'fa' ? `بررسی خطاهای بخش ${scopeTitles[scope]}` : `Review ${scopeTitles[scope]} errors`}</AdminButton></AdminFeedback>)}
      <fieldset hidden={Boolean(section && section !== 'identity')} disabled={busy || Boolean(section && section !== 'identity')}><legend>{copy.identity}</legend><div className="admin-form-grid">{identity.map(field)}</div>
        <p className="admin-attribute-help">{copy.imageHelp}</p><div className="admin-form-grid">
          <label className="admin-store-setting-field"><span>{copy.logo}</span><input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setLogo(event.target.files?.[0]); setStatus(''); }} /><ImagePreview file={logo} url={draft.logoUrl} alt={copy.logo} /><AdminButton variant="ghost" onClick={() => { setLogo(undefined); setDraft({ ...draft, logoUrl: null }); if (logoRef.current) logoRef.current.value = ''; }}>{copy.clear}</AdminButton>{errors.logo && <small role="alert">{errors.logo}</small>}</label>
          <label className="admin-store-setting-field"><span>{copy.favicon}</span><input ref={faviconRef} type="file" accept="image/png" onChange={event => { setFavicon(event.target.files?.[0]); setStatus(''); }} /><ImagePreview file={favicon} url={draft.faviconUrl} alt={copy.favicon} /><AdminButton variant="ghost" onClick={() => { setFavicon(undefined); setDraft({ ...draft, faviconUrl: null }); if (faviconRef.current) faviconRef.current.value = ''; }}>{copy.clear}</AdminButton>{errors.favicon && <small role="alert">{errors.favicon}</small>}</label>
        </div>
      </fieldset>
      <fieldset hidden={Boolean(section && section !== 'contact')} disabled={busy || Boolean(section && section !== 'contact')}><legend>{copy.contact}</legend><div className="admin-form-grid">{contact.map(field)}</div></fieldset>
      <fieldset hidden={Boolean(section && section !== 'trust')} disabled={busy || Boolean(section && section !== 'trust')}><legend>{copy.enamad}</legend>
        <div className="admin-store-seal-visibility">
          <div><p id="settings-enamad-label" className="font-bold">{copy.enamadEnabled}</p><p id="settings-enamad-help" className="admin-attribute-help">{copy.enamadVisibilityHelp}</p></div>
          <AdminButton variant="secondary" className="admin-store-seal-toggle" role="switch" aria-checked={Boolean(draft.enamadEnabled)} aria-labelledby="settings-enamad-label" aria-describedby="settings-enamad-help" disabled={busy} onClick={() => { setDraft(value => ({ ...value, enamadEnabled: !value?.enamadEnabled })); setStatus(''); }}>
            <span aria-hidden="true" className="admin-store-seal-toggle-content"><span className="admin-store-seal-toggle-track"><span /></span><span>{draft.enamadEnabled ? copy.enamadOn : copy.enamadOff}</span></span>
          </AdminButton>
        </div>
        <label className="admin-store-setting-field"><span id="settings-enamad-code-label">{copy.enamadCode}</span><textarea id="settings-enamad-code" aria-labelledby="settings-enamad-code-label" dir="ltr" rows={4} maxLength={10000} value={code} onChange={event => { setCode(event.target.value); setStatus(''); }} aria-invalid={Boolean(errors.enamadCode)} />{errors.enamadCode && <small role="alert">{errors.enamadCode}</small>}</label><p className="admin-attribute-help">{copy.enamadHelp}</p>
      </fieldset>
      {Object.entries(errors).filter(([key]) => ![...identity, ...contact, 'logo', 'favicon', 'enamadCode'].includes(key)).map(([key, value]) => <AdminFeedback key={key} tone="error">{value}</AdminFeedback>)}
      {status && <AdminFeedback tone={status === copy.saved ? 'success' : 'info'}>{status}</AdminFeedback>}
      <div className="flex flex-wrap gap-3"><AdminButton disabled={busy} type="submit" variant="brass">{busy ? copy.saving : copy.save}</AdminButton><AdminButton disabled={busy} onClick={resetDefaults} variant="secondary">{copy.defaults}</AdminButton></div>
    </form>}
  </AdminPanel>;
}

/** Recreates a small inert provider snippet for editing, without storing the administrator's original markup. */
function badgeCode(profile: StoreProfile): string {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return profile.enamad ? `<a href="${escape(profile.enamad.href)}" target="_blank"><img referrerpolicy="origin" src="${escape(profile.enamad.imageUrl)}" alt="eNamad" /></a>` : '';
}

/** Revokes temporary object URLs after file changes and on unmount. */
function ImagePreview({ file, url, alt }: { file?: File; url?: string | null; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return file || url ? <img ref={imageRef} src={!file && url ? storeImageUrl(url) : undefined} alt={alt} className="admin-store-image-preview" /> : <span className="admin-attribute-help">VENDORA</span>;
}
