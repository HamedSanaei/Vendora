'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { userLoggedIn } from '@/redux/features/auth/authSlice';
import { readCustomerAccount, saveCustomerProfile, confirmCustomerPhone, customerSession, profileReturnTo, profileErrorCode, profileRetryAfter, type CustomerAccount, type ProfileValues } from '@/lib/auth/customer-profile';
import { profileCopy, profileError } from '@/lib/auth/profile-copy';
import type { Locale } from '@/lib/vendora/types';
import { CardPanel } from './dashboard-cards';
import { TextField } from '@/components/vendora/ui/form-field';
import { VendoraButton } from '@/components/vendora/ui/button';
import { getDict } from '@/lib/vendora/i18n';

/** Extends the existing Penpot profile card with real persistence and explicit saved-phone verification. */
export function CustomerProfileForm({ locale }: { locale: Locale }) {
  const t = profileCopy(locale), copy = getDict(locale).account.profile, dispatch = useDispatch(), params = useSearchParams();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [values, setValues] = useState<ProfileValues>({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [busy, setBusy] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    readCustomerAccount(controller.signal).then(value => {
      setAccount(value); setValues({ firstName: value.completion?.firstName ?? '', lastName: value.completion?.lastName ?? '', email: value.email, phone: value.phoneNumber ?? '' });
    }).catch(() => { if (!controller.signal.aborted) setError(t.failed); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, t.failed]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  const dirty = Boolean(account && (values.firstName !== (account.completion?.firstName ?? '') || values.lastName !== (account.completion?.lastName ?? '') || values.email !== account.email || values.phone !== (account.phoneNumber ?? '')));
  const verified = account?.completion?.phoneNumberConfirmed === true && values.phone === account.phoneNumber;

  /** Saves explicit required fields without reporting success until the server confirms persistence. */
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!values.firstName.trim() || !values.lastName.trim() || !/^\S+@\S+\.\S+$/.test(values.email) || !/^09\d{9}$/.test(normalizeDigits(values.phone))) { setError(t.invalid); return; }
    setBusy('save');
    try {
      const value = await saveCustomerProfile({ ...values, phone: normalizeDigits(values.phone) }, account?.bio);
      setAccount(value); setValues({ firstName: value.completion?.firstName ?? '', lastName: value.completion?.lastName ?? '', email: value.email, phone: value.phoneNumber ?? '' });
      dispatch(userLoggedIn(customerSession(value))); setSent(false); setCode(''); setNotice(t.saved);
    } catch (failure) { setError(profileError(profileErrorCode(failure), locale)); }
    finally { setBusy(''); }
  }

  /** Sends only to the persisted phone, or consumes a code and refreshes server-owned completion facts. */
  async function verify(send: boolean) {
    if (busy || dirty) return;
    setBusy(send ? 'send' : 'confirm'); setError(''); setNotice('');
    try {
      const result = await confirmCustomerPhone(send ? undefined : normalizeDigits(code));
      if (send) { setSent(true); setCode(''); setRemaining(result.retryAfter); setNotice(t.sent); }
      else { const value = await readCustomerAccount(); setAccount(value); dispatch(userLoggedIn(customerSession(value))); setCode(''); setSent(false); setNotice(t.verified); }
    } catch (failure) { setRemaining(profileRetryAfter(failure)); setError(profileError(profileErrorCode(failure), locale)); }
    finally { setBusy(''); }
  }
  if (loading) return <p role="status">{t.loading}</p>;
  if (!account) return <CardPanel><p role="alert">{error}</p><VendoraButton onClick={() => { setLoading(true); setRevision(value => value + 1); }}>{t.retry}</VendoraButton></CardPanel>;
  return <CardPanel>
    <h2 className="text-[1.1875rem] font-bold text-ink">{copy.sectionTitle}</h2>
    {!account.completion?.isComplete && <p className="mt-4 rounded-control bg-vd-warning-tint p-4 text-sm leading-7 text-ink">{t.required}</p>}
    <form onSubmit={save} className="mt-5 space-y-6">
      <div className="grid gap-[20px] lg:grid-cols-2">
        <TextField label={t.firstName} required autoComplete="given-name" maxLength={100} value={values.firstName} onChange={e => setValues({ ...values, firstName: e.target.value })} />
        <TextField label={t.lastName} required autoComplete="family-name" maxLength={100} value={values.lastName} onChange={e => setValues({ ...values, lastName: e.target.value })} />
        <TextField label={t.email} required type="email" dir="ltr" autoComplete="email" maxLength={256} value={values.email} onChange={e => setValues({ ...values, email: e.target.value })} />
        <TextField label={t.phone} required type="tel" dir="ltr" autoComplete="tel" value={values.phone} onChange={e => setValues({ ...values, phone: normalizeDigits(e.target.value) })} />
      </div>
      <p className="rounded-control bg-jade-tint p-4 text-sm leading-7 text-vd-muted">{copy.privacyBody}</p>
      <VendoraButton type="submit" disabled={Boolean(busy)}>{busy === 'save' ? t.saving : t.save}</VendoraButton>
    </form>
    <section className="mt-7 border-t border-vd-line pt-6" aria-label={t.phoneTitle}>
      <h3 className="text-lg font-bold text-ink">{t.phoneTitle}</h3><p className={`mt-2 text-sm ${verified ? 'text-vd-success' : 'text-vd-muted'}`}>{verified ? t.verified : t.unverified}</p>
      {!verified && <><p className="mt-2 text-sm text-vd-muted">{dirty ? t.saveFirst : <bdi dir="ltr">{account.phoneNumber}</bdi>}</p>
        <VendoraButton type="button" className="mt-4" variant="outline" disabled={Boolean(busy) || dirty || !account.phoneNumber || remaining > 0} onClick={() => void verify(true)}>{busy === 'send' ? t.sending : remaining ? `${remaining} ${t.wait}` : t.send}</VendoraButton>
        {sent && <form className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); void verify(false); }}><TextField required label={t.code} inputMode="numeric" dir="ltr" autoComplete="one-time-code" minLength={4} maxLength={8} value={code} onChange={event => setCode(normalizeDigits(event.target.value))} /><VendoraButton type="submit" disabled={Boolean(busy) || dirty}>{busy === 'confirm' ? t.confirming : t.confirm}</VendoraButton></form>}
      </>}
    </section>
    {error && <p role="alert" className="mt-4 text-sm leading-7 text-vd-danger">{error}</p>}{notice && <p role="status" className="mt-4 text-sm leading-7 text-vd-success">{notice}</p>}
    {account.completion?.isComplete && !dirty && <VendoraButton href={profileReturnTo(params.get('returnTo'), locale)} className="mt-6">{t.continue}</VendoraButton>}
  </CardPanel>;
}

/** Accepts Persian/Arabic keyboard digits without altering the stored mobile/code meaning. */
function normalizeDigits(value: string) { return value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))); }
