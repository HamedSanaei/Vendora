import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createSmsCodeAutofill } from '../utils/sms-code-autofill';
import axios from 'axios';
import { getAdminMe } from '../api/adminApi';
import { confirmAdminPhoneVerification, requestAdminPhoneVerification } from '../api/smsApi';
import { adminPath } from '../i18n';
import type { AdminAuthProfile } from '../types';
import { smsErrorMessage } from '../utils/sms-errors';
import { AdminButton, AdminFeedback, AdminField } from './AdminUi';

interface AdminPhoneVerificationProps {
  locale: 'fa' | 'en';
  enabled: boolean;
  remaining: number;
  onCooldown: (seconds: number) => void;
  onVerified: () => void;
  active?: boolean;
}

/** Verifies the current administrator's saved phone inside the admin panel using existing account APIs. */
export function AdminPhoneVerification({ locale, enabled, remaining, onCooldown, onVerified, active = true }: AdminPhoneVerificationProps) {
  const fa = locale === 'fa';
  const autofill = useMemo(() => createSmsCodeAutofill(), []);
  useEffect(() => { if (!active) autofill.cancel(); return () => autofill.cancel(); }, [active, autofill]);
  const [profile, setProfile] = useState<AdminAuthProfile | null>(null);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [code, setCode] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const verified = Boolean(profile?.phoneNumber && profile.completion?.phoneNumberConfirmed === true);

  useEffect(() => {
    let active = true;
    void getAdminMe().then(value => {
      if (active) { setProfile(value); setSent(false); setCode(''); setError(''); }
    }).catch(() => { if (active) setError(fa ? 'اطلاعات شمارهٔ حساب مدیر دریافت نشد؛ دوباره دریافت کنید.' : 'Could not load your account phone. Reload it.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, fa]);

  /** Shows only allow-listed errors and honors the existing shared resend budget without automatic sends. */
  function failure(cause: unknown): void {
    const response = axios.isAxiosError<{ code?: unknown; retryAfter?: unknown }>(cause) ? cause.response : undefined;
    setError(smsErrorMessage(response?.data?.code, response?.status, locale));
    const wait = Number(response?.data?.retryAfter ?? response?.headers['retry-after']);
    if (Number.isFinite(wait) && wait > 0) onCooldown(Math.min(1800, Math.ceil(wait)));
  }

  /** Sends to the server-owned saved number only; neither a phone nor a user ID is submitted by this form. */
  async function send(): Promise<void> {
    if (busy || !enabled || !profile?.phoneNumber || remaining > 0) return;
    setBusy(true); setError(''); setNotice('');
    autofill.start();
    try {
      const result = await requestAdminPhoneVerification();
      onCooldown(Math.min(1800, Math.max(0, result.retryAfter || 0)));
      if (result.code === 'PHONE_ALREADY_VERIFIED') {
        autofill.cancel();
        const current = await getAdminMe(); setProfile(current);
        if (current.completion?.phoneNumberConfirmed === true) onVerified();
      } else {
        setSent(true); setCode('');
        autofill.ready(setCode);
        setNotice(fa ? 'کد به شمارهٔ ثبت‌شدهٔ همین حساب ارسال شد؛ آن را در کادر زیر وارد کنید.' : 'A code was sent to this account’s saved number. Enter it below.');
      }
    } catch (cause) { autofill.cancel(); failure(cause); }
    finally { setBusy(false); }
  }

  /** Consumes the ownership proof and refreshes the server-owned flag before announcing confirmation. */
  async function confirm(event: FormEvent): Promise<void> {
    event.preventDefault(); if (busy) return;
    autofill.cancel();
    setBusy(true); setError(''); setNotice('');
    try {
      await confirmAdminPhoneVerification(code);
      const current = await getAdminMe(); setProfile(current);
      if (current.completion?.phoneNumberConfirmed !== true) throw new Error('Phone confirmation not observed');
      setSent(false); setCode(''); onVerified();
    } catch (cause) { failure(cause); }
    finally { setBusy(false); }
  }

  return <section className="admin-discussion-entry" aria-label={fa ? 'تأیید شمارهٔ حساب مدیر' : 'Verify administrator phone'}>
    <h3>{fa ? 'تأیید شمارهٔ همراه من' : 'Verify my mobile number'}</h3>
    {loading ? <p role="status">{fa ? 'در حال دریافت شمارهٔ حساب…' : 'Loading your account phone…'}</p> : <>
      <p>{fa ? 'شمارهٔ ثبت‌شدهٔ حساب مدیر فعلی: ' : 'Current administrator’s saved number: '}<bdi dir="ltr">{profile?.phoneNumber || '—'}</bdi></p>
      {verified ? <AdminFeedback tone="success">{fa ? 'شمارهٔ همراه این حساب تأیید شده است.' : 'This account’s mobile number is verified.'}</AdminFeedback> : <>
        <p>{fa ? 'همین‌جا کد دریافت کنید و شماره را تأیید کنید؛ نیازی به ورود به فروشگاه نیست.' : 'Receive and confirm a code here without signing in to the storefront.'}</p>
        {!profile?.phoneNumber && <p>{fa ? 'ابتدا شمارهٔ حساب خود را در بخش کاربران ثبت کنید، سپس «دریافت مجدد شماره» را بزنید.' : 'Save your phone in Users, then reload the number here.'}</p>}
        {!enabled && <p>{fa ? 'تنظیمات پیامک را ذخیره کنید؛ سرویس، تأیید شماره در پروفایل و اتصال روش ارسال انتخاب‌شده باید آماده باشند.' : 'Save SMS settings; the service, profile verification and selected sending mode must be ready.'}</p>}
        <AdminButton disabled={busy || !enabled || !profile?.phoneNumber || remaining > 0} onClick={() => void send()} variant="brass">
          {busy ? (fa ? 'در حال بررسی…' : 'Working…') : remaining > 0 ? `${remaining} ${fa ? 'ثانیه تا ارسال مجدد' : 'seconds before resending'}` : (fa ? 'ارسال کد تأیید شمارهٔ من' : 'Send my phone verification code')}
        </AdminButton>
        {sent && <form className="admin-form" onSubmit={event => void confirm(event)}>
          <AdminField label={fa ? 'کد تأیید شمارهٔ من' : 'My phone verification code'} dir="ltr" inputMode="numeric" autoComplete="one-time-code" required minLength={4} maxLength={8} value={code}
            onChange={event => setCode(event.target.value.replace(/[۰-۹]/g, char => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char))).replace(/[٠-٩]/g, char => String('٠١٢٣٤٥٦٧٨٩'.indexOf(char))))} />
          <AdminButton type="submit" disabled={busy}>{fa ? 'تأیید شمارهٔ همراه من' : 'Confirm my mobile number'}</AdminButton>
        </form>}
      </>}
    </>}
    {error && <AdminFeedback tone="error">{error}</AdminFeedback>}
    {notice && <AdminFeedback tone="success">{notice}</AdminFeedback>}
    <div className="admin-page-actions">
      <AdminButton variant="secondary" disabled={busy || loading} onClick={() => { autofill.cancel(); setLoading(true); setNotice(''); setRevision(value => value + 1); }}>{fa ? 'دریافت مجدد شماره' : 'Reload my number'}</AdminButton>
      <AdminButton to={adminPath(locale, 'profile')} variant="ghost">{fa ? 'ویرایش شماره در کاربران' : 'Edit number in Users'}</AdminButton>
    </div>
  </section>;
}
