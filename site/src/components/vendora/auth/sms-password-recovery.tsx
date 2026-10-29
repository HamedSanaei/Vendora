"use client";
import { useDispatch } from "react-redux";
import { userLoggedOut } from "@/redux/features/auth/authSlice";
import { apiSlice } from "@/redux/api/apiSlice";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSmsCodeAutofill } from '@/lib/auth/sms-code-autofill';
import { usePathname } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { smsCapabilities, recoveryRequest, recoveryVerify, recoveryReset, smsErrorCode, smsErrorMessage } from "@/lib/sms-client";
import { VendoraButton } from "../ui/button";
import { TextField } from "../ui/form-field";

/** Replaces the insecure token-display recovery screen with a real, purpose-bound verified-phone flow. */
export function SmsPasswordRecovery() {
  const dispatch = useDispatch();
  const autofill = useMemo(() => createSmsCodeAutofill(), []);
  useEffect(() => () => autofill.cancel(), [autofill]);
  const locale = getLocaleFromPathname(usePathname()), fa = locale === "fa";
  const [enabled,setEnabled] = useState<boolean|null>(null), [phone,setPhone] = useState(""), [code,setCode] = useState(""), [password,setPassword] = useState(""), [confirmation,setConfirmation] = useState("");
  const [stage,setStage] = useState<"phone"|"code"|"password"|"done">("phone"), [challenge,setChallenge] = useState(""), [grant,setGrant] = useState(""), [length,setLength] = useState(5), [seconds,setSeconds] = useState(0);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  useEffect(() => { const abort = new AbortController(); smsCapabilities(abort.signal).then(value => setEnabled(value.passwordRecovery)).catch(() => { if (!abort.signal.aborted) setEnabled(false); }); return () => abort.abort(); },[]);
  useEffect(() => { if (seconds <= 0) return; const timer = setInterval(() => setSeconds(value => Math.max(0,value-1)),1000); return () => clearInterval(timer); },[seconds]);
  /** Preserves drafts on error and never stores the transient grant in localStorage or a URL. */
  async function submit(event?: FormEvent) {
    event?.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      if (stage === "phone") { autofill.start(); const result = await recoveryRequest(phone); setChallenge(result.challengeId ?? ""); setLength(result.codeLength); setSeconds(result.retryAfter); setStage("code"); autofill.ready(value => { if (value.length === result.codeLength) setCode(value); }); }
      if (stage === "code") { autofill.cancel(); const result = await recoveryVerify(challenge,code); if (!result.resetGrant) throw new Error("Missing grant"); setGrant(result.resetGrant); setStage("password"); }
      if (stage === "password") {
        if (password !== confirmation) { setError(fa ? "تکرار رمز یکسان نیست." : "Passwords do not match."); return; }
        await recoveryReset(challenge,grant,password); setGrant(""); setPassword(""); setConfirmation(""); setStage("done"); dispatch(userLoggedOut()); dispatch(apiSlice.util.resetApiState());
      }
    } catch (failure) { autofill.cancel(); setError(smsErrorMessage(smsErrorCode(failure),fa)); } finally { setBusy(false); }
  }
  return <section className="vd-root bg-surface-soft px-4 py-10" dir={fa ? "rtl" : "ltr"}><div className="mx-auto max-w-[520px] rounded-card border border-vd-line bg-white p-6 md:p-8">
    <h1 className="text-2xl font-extrabold">{fa ? "بازیابی رمز عبور" : "Password recovery"}</h1>
    <p className="mt-3 text-sm leading-7 text-vd-muted">{fa ? "کد بازیابی فقط به شمارهٔ تأییدشدهٔ حساب شما ارسال می‌شود. برای حساب فاقد شمارهٔ تأییدشده از ورود گوگل یا پشتیبانی کمک بگیرید." : "Recovery requires your verified phone. Otherwise sign in with Google or contact support."}</p>
    {enabled === null ? <p role="status">{fa ? "در حال بررسی…" : "Loading…"}</p> : !enabled ? <p role="status" className="mt-5">{fa ? "بازیابی پیامکی فعلاً فعال نیست." : "SMS recovery is unavailable."}</p> : stage === "done" ? <p role="status" className="mt-5 rounded-control bg-jade-tint p-4 text-jade">{fa ? "رمز تغییر کرد؛ اکنون دوباره وارد شوید." : "Password changed. Sign in again."}</p> : <form onSubmit={submit} className="mt-6 grid gap-4">
      {stage === "phone" && <TextField label={fa ? "شماره همراه تأییدشده" : "Verified phone"} type="tel" dir="ltr" required value={phone} onChange={event => setPhone(event.target.value)} />}
      {stage === "code" && <><p className="text-sm">{fa ? "اگر حساب واجد شرایط باشد، کد برای شمارهٔ آن ارسال می‌شود." : "A code is sent if the account is eligible."}</p><TextField label={fa ? "کد بازیابی" : "Recovery code"} autoComplete="one-time-code" inputMode="numeric" dir="ltr" required minLength={length} maxLength={length} value={code} onChange={event => setCode(event.target.value)} /><VendoraButton type="button" variant="ghost" disabled={seconds>0} onClick={() => { autofill.cancel(); setStage("phone"); setCode(""); }}>{seconds>0 ? `${seconds} ${fa ? "ثانیه تا ارسال مجدد" : "seconds"}` : (fa ? "ویرایش شماره / ارسال مجدد" : "Edit number / resend")}</VendoraButton></>}
      {stage === "password" && <><TextField label={fa ? "رمز جدید" : "New password"} type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /><TextField label={fa ? "تکرار رمز جدید" : "Confirm password"} type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></>}
      <VendoraButton type="submit" disabled={busy}>{busy ? (fa ? "در حال انجام…" : "Working…") : stage === "phone" ? (fa ? "ارسال کد بازیابی" : "Send code") : stage === "code" ? (fa ? "تأیید کد" : "Verify code") : (fa ? "ثبت رمز جدید" : "Save password")}</VendoraButton>
    </form>}
    {error && <p role="alert" className="mt-4 rounded-control bg-vd-danger-tint p-3 text-sm text-vd-danger">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-5 text-sm font-bold text-jade"><Link className="vd-focus min-h-11" href={withLocalePath("/login",locale)}>{fa ? "بازگشت به ورود" : "Sign in"}</Link><Link className="vd-focus min-h-11" href={withLocalePath("/contact",locale)}>{fa ? "تماس با پشتیبانی" : "Contact support"}</Link></div>
  </div></section>;
}
