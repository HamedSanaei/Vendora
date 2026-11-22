import axios from 'axios';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminButton, AdminCheckbox, AdminFeedback, AdminField, AdminPanel, AdminSelect } from './AdminUi';
import { egressApi, type EgressCheck, type EgressProfile, type EgressSettings, type ProfileDraft, type ProxyScheme } from '../api/egressApi';

const serviceNames: Record<string, [string, string]> = {
  google: ['ورود گوگل', 'Google Sign-In'],
  parsgreen: ['پارس‌گرین', 'ParsGreen'],
  kavenegar: ['کاوه‌نگار', 'Kavenegar'],
  tabapay: ['تاباپی', 'TabaPay'],
  rates: ['نرخ ارز و تتر', 'USDT exchange rates'],
  postex: ['پستکس', 'Postex'],
  neshan: ['نقشه نشان', 'Neshan'],
  seo: ['سئوی هوشمند 9Router', '9Router SEO'],
};
const emptyDraft: ProfileDraft = { name: '', scheme: 'http', host: '', port: 8080,
  timeoutSeconds: 10, enabled: true, note: '', user: '', password: '', clearCredential: false };

/** Formats only sanitized probe outcomes; reachability is distinct from an anonymous upstream success. */
function probeLabel(check: EgressCheck, fa: boolean): string {
  const labels: Record<string, [string, string]> = {
    Success: ['موفق', 'Passed'], Timeout: ['پایان مهلت پاسخ', 'Timed out'], TlsError: ['اعتبار TLS تأیید نشد', 'TLS validation failed'],
    ProxyAuthentication: ['احراز هویت پروکسی ناموفق بود', 'Proxy authentication failed'],
    ConnectionFailed: ['اتصال برقرار نشد', 'Connection failed'], InvalidResponse: ['پاسخ مقصد معتبر نبود', 'Invalid upstream response'],
    NotConfigured: ['سرویس تنظیم نشده است', 'Service is not configured'], ProfileDisabled: ['پروفایل خاموش است', 'Profile disabled'],
  };
  const code = check.code.startsWith('UpstreamHttp:') ? check.code.split(':')[1] : null;
  return code ? (fa ? `مقصد پاسخ HTTP ${code} داد` : `Upstream responded HTTP ${code}`)
    : labels[check.code]?.[fa ? 0 : 1] ?? (fa ? 'ناموفق' : 'Failed');
}

/** Renders server-derived status and the path used by the last test. */
function LastTest({ check, fa }: { check?: EgressCheck | null; fa: boolean }) {
  if (!check) return <p>{fa ? 'هنوز تست نشده' : 'Not tested yet'}</p>;
  const path = check.path === 'Proxy' ? (fa ? 'پروکسی' : 'Proxy') : (fa ? 'مستقیم' : 'Direct');
  return <p>{probeLabel(check, fa)} · {path} · <bdi>{check.milliseconds.toLocaleString(fa ? 'fa-IR' : 'en-US')} ms</bdi> ·
    {' '}<time dateTime={check.at}>{new Date(check.at).toLocaleString(fa ? 'fa-IR' : 'en-US')}</time></p>;
}

/** Reuses store settings primitives for profile editing, per-service routes, probes and audit history. */
export function AdminEgressSettings({ locale }: { locale: 'fa' | 'en' }) {
  const fa = locale === 'fa';
  const [settings, setSettings] = useState<EgressSettings>();
  const [draft, setDraft] = useState<ProfileDraft>();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState<EgressProfile>();

  useEffect(() => {
    let current = true;
    egressApi.read().then(value => { if (current) setSettings(value); })
      .catch(() => { if (current) setError('EGRESS_LOAD_FAILED'); });
    return () => { current = false; };
  }, []);

  /** Runs one explicit operation and reloads the persisted snapshot. */
  async function act(operation: () => Promise<void>) {
    setError('');
    setBusy(true);
    try { await operation(); setSettings(await egressApi.read()); }
    catch (e) {
      const code: unknown = axios.isAxiosError(e) ? e.response?.data?.code : undefined;
      setError(typeof code === 'string' && code.startsWith('EGRESS_') ? code : 'EGRESS_REQUEST_FAILED');
    }
    finally { setBusy(false); }
  }

  /** Edits a non-secret projection and leaves the credential fields empty. */
  function edit(profile: EgressProfile) {
    const { id, version, name, scheme, host, port, timeoutSeconds, enabled, note } = profile;
    setDraft({ ...emptyDraft, id, version, name, scheme, host, port, timeoutSeconds, enabled, note });
  }

  /** Saves credentials write-only and clears them from local form state after success. */
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    void act(async () => { await egressApi.save(draft); setDraft(undefined); });
  }

  const errors: Record<string, [string, string]> = {
    EGRESS_SETTINGS_CHANGED: ['تنظیمات هم‌زمان تغییر کرده است. دوباره بارگذاری کنید.', 'Settings changed. Reload and try again.'],
    EGRESS_PROXY_HOST_UNREACHABLE: ['نام میزبان باید به یک نشانی عمومی قابل‌دسترسی اشاره کند.', 'The proxy host must resolve to a public address.'],
    EGRESS_PROFILE_ASSIGNED: ['ابتدا سرویس‌های متصل را روی مسیر مستقیم قرار دهید.', 'Set assigned services to Direct before removing this profile.'],
    EGRESS_PROFILE_REQUIRED: ['یک پروفایل فعال و مجاز انتخاب کنید.', 'Select an enabled, eligible proxy profile.'],
    EGRESS_REENTER_CREDENTIAL: ['برای تغییر مقصد پروکسی، ورود را دوباره وارد یا پاک کنید.', 'Re-enter or remove credentials when changing the proxy endpoint.'],
    EGRESS_INVALID_CREDENTIAL: ['نام کاربری و رمز را با هم وارد کنید.', 'Enter both the username and password.'],
    EGRESS_INVALID_PROFILE: ['نام، میزبان، پورت و مهلت پاسخ را بررسی کنید.', 'Check the profile name, host, port and timeout.'],
  };

  return <AdminPanel title={fa ? 'شبکه و پروکسی خروجی' : 'Network & outbound proxy'}>
    {error && <AdminFeedback tone="error">{errors[error]?.[fa ? 0 : 1] ?? (fa ? 'عملیات انجام نشد. دوباره تلاش کنید.' : 'Unable to complete the operation. Please retry.')}</AdminFeedback>}
    {!settings ? (error ? <AdminButton onClick={() => void act(async () => {})}>{fa ? 'دریافت مجدد' : 'Reload'}</AdminButton>
      : <p role="status">{fa ? 'در حال دریافت تنظیمات…' : 'Loading settings…'}</p>) : <>
      <div className="admin-discussion-entry">
        <h3>{fa ? 'پروفایل‌ها' : 'Proxy profiles'}</h3>
        {!settings.profiles.length && <p>{fa ? 'هنوز پروفایلی ذخیره نشده است.' : 'No saved profiles yet.'}</p>}
        {settings.profiles.map(profile => <div className="admin-discussion-entry" key={profile.id}>
          <strong>{profile.name}</strong>
          <p><bdi style={{ overflowWrap: 'anywhere' }}>{profile.scheme}://{profile.host}:{profile.port}</bdi> · {profile.enabled ? (fa ? 'فعال' : 'Enabled') : (fa ? 'خاموش' : 'Off')}</p>
          {profile.note && <p>{profile.note}</p>}
          <LastTest check={profile.lastTest} fa={fa} />
          <div className="admin-form-grid">
            <AdminButton disabled={busy} variant="secondary" onClick={() => edit(profile)}>{fa ? 'ویرایش' : 'Edit'}</AdminButton>
            <AdminButton disabled={busy || !profile.enabled} variant="secondary" onClick={() => void act(() => egressApi.test({ proxyId: profile.id }))}>{fa ? 'تست پروکسی با گوگل' : 'Test proxy with Google'}</AdminButton>
            <AdminButton disabled={busy} variant="secondary" onClick={() => setRemove(profile)}>{fa ? 'حذف' : 'Remove'}</AdminButton>
          </div>
          {remove?.id === profile.id && <AdminFeedback tone="warning">
            {fa ? 'این پروفایل حذف شود؟' : 'Remove this profile?'}{' '}
            <AdminButton disabled={busy} onClick={() => void act(async () => { await egressApi.remove(profile); setRemove(undefined); if (draft?.id === profile.id) setDraft(undefined); })}>{fa ? 'تأیید حذف' : 'Confirm removal'}</AdminButton>{' '}
            <AdminButton disabled={busy} variant="secondary" onClick={() => setRemove(undefined)}>{fa ? 'انصراف' : 'Cancel'}</AdminButton>
          </AdminFeedback>}
        </div>)}
        <AdminButton disabled={busy} onClick={() => setDraft({ ...emptyDraft })}>{fa ? 'افزودن پروفایل' : 'Add profile'}</AdminButton>
        {draft && <form className="admin-discussion-entry" onSubmit={save} autoComplete="off">
          <div className="admin-form-grid">
            <AdminField required maxLength={80} label={fa ? 'نام پروفایل' : 'Profile name'} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            <AdminSelect label={fa ? 'نوع پروکسی' : 'Proxy type'} value={draft.scheme} onChange={e => setDraft({ ...draft, scheme: e.target.value as ProxyScheme })}>
              <option value="http">HTTP CONNECT</option><option value="https">HTTPS CONNECT</option><option value="socks5">SOCKS5</option>
            </AdminSelect>
            <AdminField required dir="ltr" maxLength={253} label={fa ? 'میزبان' : 'Host'} value={draft.host} onChange={e => setDraft({ ...draft, host: e.target.value })} />
            <AdminField required type="number" min={1} max={65535} label={fa ? 'پورت' : 'Port'} value={draft.port} onChange={e => setDraft({ ...draft, port: e.target.valueAsNumber })} />
            <AdminField required type="number" min={2} max={60} label={fa ? 'مهلت پاسخ به ثانیه' : 'Timeout in seconds'} value={draft.timeoutSeconds} onChange={e => setDraft({ ...draft, timeoutSeconds: e.target.valueAsNumber })} />
            <AdminField maxLength={240} label={fa ? 'یادداشت' : 'Note'} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />
            <AdminField dir="ltr" maxLength={200} label={fa ? 'نام کاربری اختیاری' : 'Optional username'} disabled={draft.clearCredential} value={draft.user} onChange={e => setDraft({ ...draft, user: e.target.value })} />
            <AdminField dir="ltr" maxLength={200} type="password" autoComplete="new-password" label={fa ? 'رمز جدید اختیاری' : 'Optional new password'} disabled={draft.clearCredential} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} />
            <AdminCheckbox label={fa ? 'پروفایل فعال' : 'Profile enabled'} checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />
            {settings.profiles.some(x => x.id === draft.id && x.hasCredential) && <AdminCheckbox label={fa ? 'پاک‌کردن اطلاعات ورود ذخیره‌شده' : 'Remove saved credentials'} checked={draft.clearCredential} onChange={e => setDraft({ ...draft, clearCredential: e.target.checked, user: '', password: '' })} />}
          </div>
          <AdminButton disabled={busy} type="submit">{fa ? 'ذخیره پروفایل' : 'Save profile'}</AdminButton>{' '}
          <AdminButton disabled={busy} variant="secondary" onClick={() => setDraft(undefined)}>{fa ? 'انصراف' : 'Cancel'}</AdminButton>
        </form>}
      </div>
      <div className="admin-discussion-entry">
        <h3>{fa ? 'مسیر هر سرویس' : 'Per-service routing'}</h3>
        {settings.routes.map(route => {
          const saved = route.enabled ? route.proxyId ?? '' : '';
          const value = choices[route.service] ?? saved;
          const label = serviceNames[route.service]?.[fa ? 0 : 1] ?? route.service;
          return <div className="admin-discussion-entry" key={route.service}>
            <div className="admin-form-grid">
              <AdminSelect label={label} value={value} onChange={e => setChoices({ ...choices, [route.service]: e.target.value })}>
                <option value="">{fa ? 'مستقیم / غیرفعال' : 'Direct / Off'}</option>
                {settings.profiles.filter(x => x.id === saved || route.canProxy && x.enabled).map(x =>
                  <option key={x.id} value={x.id} disabled={!x.enabled || !route.canProxy}>{x.name}{!x.enabled ? (fa ? ' (خاموش)' : ' (off)') : ''}</option>)}
              </AdminSelect>
              <AdminButton disabled={busy || value === saved} onClick={() => void act(() => egressApi.assign(route, value))}>{fa ? 'اعمال مسیر' : 'Apply route'}</AdminButton>
              <AdminButton disabled={busy} variant="secondary" onClick={() => void act(() => egressApi.test({ service: route.service }))}>{fa ? 'تست مسیر ذخیره‌شده' : 'Test saved route'}</AdminButton>
            </div>
            <LastTest check={route.lastTest} fa={fa} />
          </div>;
        })}
      </div>
      {settings.audit.length > 0 && <details className="admin-discussion-entry">
        <summary>{fa ? 'رویدادهای تغییر تنظیمات' : 'Settings audit'}</summary>
        <ul>{settings.audit.map(row => <li key={row.id} style={{ overflowWrap: 'anywhere' }}>
          <time dateTime={row.at}>{new Date(row.at).toLocaleString(fa ? 'fa-IR' : 'en-US')}</time> · <bdi>{row.action} · {row.target} · {row.actor ?? (fa ? 'سرور' : 'server')}</bdi>
        </li>)}</ul>
      </details>}
    </>}
  </AdminPanel>;
}
