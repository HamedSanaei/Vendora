"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { useLoginUserMutation } from "@/redux/features/auth/authApi";
import { userLoggedIn } from "@/redux/features/auth/authSlice";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { type AuthAccount, type PhoneAuthAdapter } from "@/lib/auth/auth-adapter";
import { notifySuccess } from "@/utils/toast";
import { CheckoutContextNotice, LoginBenefits, LoginModeTabs, OtpInput, PhoneField, type LoginMode } from "./login-components";
import { GoogleIdentityButton } from "./google-identity-button";
import { http } from "@/lib/http";
import axios from "axios";
import { storePresentation, useStoreSettings } from '../layout/store-settings-provider';
import { resolveApiImageUrl } from '@/lib/http';
import { completeProfileHref, type ProfileCompletion } from '@/lib/auth/customer-profile';
import { getDict } from "@/lib/vendora/i18n";
import { EyeIcon } from "../icons";
import { googleErrorMessage } from '@/lib/auth/google-errors';

import { createPhoneAuthAdapter, smsErrorMessage } from "@/lib/sms-client";
import { createSmsCodeAutofill } from '@/lib/auth/sms-code-autofill';

type PhoneStep = "identifier" | "otp";

interface LoginCardProps {
  locale: Locale;
  returnTo?: string;
  phoneAdapter?: PhoneAuthAdapter;
  intent?: "login" | "register";
}

/** Penpot-aligned responsive login card with email, phone OTP and Google modes. */
export function LoginCard({ locale, returnTo, phoneAdapter, intent = "login" }: LoginCardProps) {
  const isFa = locale === "fa";
  const copy = getDict(locale).auth;
  const registering = intent === "register";
  const [fullName, setFullName] = useState("");
  const storeProfile = useStoreSettings();
  const brand = storePresentation(storeProfile, locale);
  const router = useRouter();
  const dispatch = useDispatch();
  const [loginUser, { isLoading: emailLoading }] = useLoginUserMutation();
  const [mode, setMode] = useState<LoginMode>("phone");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("identifier");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cooldownPhone, setCooldownPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const destination = safeReturnTo(returnTo, locale);
  const adapter = useMemo(() => phoneAdapter ?? createPhoneAuthAdapter(), [phoneAdapter]);
  const autofill = useMemo(() => createSmsCodeAutofill(), []);
  useEffect(() => () => autofill.cancel(), [autofill]);
  const googleAvailable = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const changeMode = (nextMode: LoginMode) => {
    autofill.cancel();
    setMode(nextMode);
    setError("");
    setInfo("");
    if (nextMode === "phone") setPhoneStep("identifier");
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError(isFa ? "ایمیل معتبر وارد کنید." : "Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError(isFa ? "رمز عبور باید حداقل ۶ کاراکتر باشد." : "Password must contain at least 6 characters.");
      return;
    }
    const result = await loginUser({ email: email.trim(), password }) as { data?: { completion?: ProfileCompletion }; error?: { data?: { message?: string; error?: string } } };
    if (result?.error) {
      setError(result.error?.data?.message ?? result.error?.data?.error ?? (isFa ? "ورود ناموفق بود." : "Login failed."));
      return;
    }

    notifySuccess(isFa ? "با موفقیت وارد شدید." : "You are signed in.");
    router.push(result.data?.completion?.isComplete ? destination : completeProfileHref(locale, destination));
  };

  /** Requests a server-bound proof; signup names remain local until verification succeeds. */
  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setInfo("");
    if (phoneLoading || (secondsLeft > 0 && cooldownPhone === normalizePhone(phone))) return;
    if (registering && !validFullName(fullName)) { setError(copy.invalidName); return; }
    const normalizedPhone = normalizePhone(phone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError(isFa ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد." : "Enter an 11-digit Iranian mobile number starting with 09.");
      return;
    }
    setPhoneLoading(true);
    autofill.start();
    const result = await adapter.requestCode(normalizedPhone);
    setPhoneLoading(false);
    if (!result.ok) {
      autofill.cancel();
      setSecondsLeft(result.retryAfter ?? 0);
      setCooldownPhone(normalizedPhone);
      setError(adapterMessage(result.message, isFa ? "ارسال کد انجام نشد." : "The code could not be sent.", isFa ? "ورود با کد پیامکی هنوز به سرویس پیامک متصل نشده است." : "Phone sign-in is not connected to an SMS service yet."));
      return;
    }
    setCooldownPhone(normalizedPhone);
    setSecondsLeft(result.retryAfter ?? 120);
    setOtp(Array(Math.min(8, Math.max(4, result.codeLength ?? 5))).fill(""));
    setPhoneStep("otp");
    autofill.ready(code => { if (code.length === (result.codeLength ?? 5)) setOtp(code.split('')); });
    setInfo(isFa ? "اگر شماره واجد شرایط باشد، کد ورود برای آن ارسال می‌شود." : "A code is sent if the number is eligible.");
    window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    autofill.cancel();
    setError("");
    const code = otp.join("");
    if (code.length !== otp.length || /\D/.test(code)) {
      setError(isFa ? "کد را کامل وارد کنید." : "Enter the complete code.");
      return;
    }
    setPhoneLoading(true);
    const result = await adapter.verifyCode(normalizePhone(phone), code, registering ? fullName.trim() : undefined);
    setPhoneLoading(false);
    if (!result.ok || !result.account) {
      setError(adapterMessage(result.message, secondsLeft === 0 ? (isFa ? "کد منقضی شده است." : "The code has expired.") : (isFa ? "کد واردشده صحیح نیست." : "The code is incorrect."), isFa ? "تأیید کد پیامکی هنوز به سرویس احراز هویت متصل نشده است." : "Phone verification is not connected to an auth service yet."));
      return;
    }
    persistAdapterAccount(result.account, dispatch);
    notifySuccess(isFa ? "با موفقیت وارد شدید." : "You are signed in.");
    // Phone proof creates the session; missing required details are completed inside the customer panel.
    router.push(result.account.user.completion?.isComplete ? destination : completeProfileHref(locale, destination));
  };

  const handleGoogle = async (credential: string) => {
    setError("");
    setGoogleLoading(true);
    try {
      const { data } = await http.post("/account/google", { credential });
      if (!data?.token || !data?.id) throw new Error("Invalid authentication response");
      persistGoogleAccount(data, dispatch);
      notifySuccess(isFa ? "با حساب Google وارد شدید." : "Signed in with Google.");
      router.replace(data.completion?.isComplete ? destination : completeProfileHref(locale, destination));
    } catch (failure) {
      const message = axios.isAxiosError(failure) ? failure.response?.data?.message : "";
      setError(googleErrorMessage(message ?? '', axios.isAxiosError(failure) ? failure.response?.status : 500, locale));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const pasted = normalizeDigits(value).replace(/\D/g, '').slice(0, otp.length);
    if (index === 0 && pasted.length > 1) {
      setOtp([...pasted.split(''), ...Array(otp.length - pasted.length).fill('')]);
      otpRefs.current[Math.min(pasted.length, otp.length) - 1]?.focus(); return;
    }
    const digit = normalizeDigits(value).replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < otp.length - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = normalizeDigits(event.clipboardData.getData("text")).replace(/\D/g, "").slice(0, otp.length).split("");
    if (!pasted.length) return;
    setOtp([...pasted, ...Array(otp.length - pasted.length).fill("")]);
    otpRefs.current[Math.min(pasted.length, otp.length) - 1]?.focus();
  };

  const busy = phoneLoading || emailLoading || googleLoading;
  const requestWait = cooldownPhone === normalizePhone(phone) ? secondsLeft : 0;
  const checkout = /\/(shipping|checkout)(?:[/?#]|$)/.test(destination);
  const alternateHref = `${withLocalePath(registering ? "/login" : "/register", locale)}?returnTo=${encodeURIComponent(destination)}`;

  return (
    <section className="vd-root vd-auth-section" dir={isFa ? "rtl" : "ltr"}>
      <div className="vd-auth-layout">
        <div className="vd-auth-card" aria-busy={busy}>
          <header>
            <p className="text-[13px] font-bold leading-6 text-jade">{copy.eyebrow}</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-10 text-ink md:text-2xl">{registering ? copy.registerTitle : copy.signInTitle}</h1>
            <p className="text-[13px] leading-6 text-vd-muted">{registering ? copy.registerIntro : copy.chooseMethod}</p>
          </header>
          {checkout ? <CheckoutContextNotice locale={locale} /> : null}
          {!registering ? <LoginModeTabs locale={locale} mode={mode} onChange={changeMode} disabled={busy} /> : null}

          {mode === "phone" && phoneStep === "identifier" ? (
            <form onSubmit={requestCode} className="mt-[16px]" noValidate>
              {registering ? <div className="mb-5"><FieldLabel htmlFor="register-name" label={copy.fullName} /><input id="register-name" value={fullName} onChange={event => { setFullName(event.target.value); setError(""); }} autoComplete="name" maxLength={201} required aria-invalid={error === copy.invalidName || undefined} className="vd-auth-field vd-focus border-vd-line" /></div> : null}
              <PhoneField locale={locale} value={phone} onChange={value => { setPhone(value); setError(""); }} invalid={Boolean(error) && error !== copy.invalidName} />
              <button type="submit" disabled={busy || requestWait > 0} className="vd-auth-submit vd-focus mt-[30px]">{phoneLoading ? (isFa ? "در حال ارسال…" : "Sending…") : requestWait > 0 ? (isFa ? `ارسال مجدد تا ${requestWait.toLocaleString("fa-IR")} ثانیه دیگر` : `Retry in ${requestWait}s`) : registering ? copy.registerCode : (isFa ? "ارسال کد ورود" : "Send sign-in code")}</button>
            </form>
          ) : null}
          {mode === "phone" && phoneStep === "otp" ? (
            <form onSubmit={verifyCode} className="mt-6">
              <p className="text-sm font-semibold leading-7 text-vd-muted">{isFa ? "کد ارسال‌شده به" : "Code sent to"} <bdi dir="ltr" className="font-extrabold text-ink">{phone}</bdi></p>
              <OtpInput locale={locale} digits={otp} invalid={Boolean(error)} setInputRef={(index, element) => { otpRefs.current[index] = element; }} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} />
              <button type="submit" disabled={busy} className="vd-auth-submit vd-focus mt-5">{phoneLoading ? (isFa ? "در حال بررسی…" : "Verifying…") : (isFa ? "تأیید و ورود" : "Verify and sign in")}</button>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <button type="button" disabled={busy} onClick={() => { autofill.cancel(); setPhoneStep("identifier"); setError(""); setInfo(""); }} className="vd-focus min-h-11 rounded-sm font-bold text-jade">{isFa ? "ویرایش شماره" : "Edit number"}</button>
                {secondsLeft > 0 ? <span className="text-vd-muted">{isFa ? `${secondsLeft.toLocaleString("fa-IR")} ثانیه تا ارسال مجدد` : `Resend in ${secondsLeft}s`}</span> : <button type="button" disabled={busy} onClick={() => void requestCode()} className="vd-focus min-h-11 rounded-sm font-bold text-jade">{isFa ? "ارسال مجدد" : "Resend code"}</button>}
              </div>
            </form>
          ) : null}
          {!registering && mode === "email" ? (
            <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
              <div><FieldLabel htmlFor="login-email" label={isFa ? "ایمیل" : "Email"} /><input id="login-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="username" dir="ltr" placeholder="name@example.com" aria-invalid={Boolean(error) || undefined} className={`vd-focus vd-auth-field ${error ? "border-vd-danger" : "border-vd-line"}`} /></div>
              <div>
                <div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="login-password" label={isFa ? "رمز عبور" : "Password"} /><Link href={withLocalePath("/forgot", locale)} className="vd-focus inline-flex min-h-11 items-center text-[13px] font-bold text-jade">{isFa ? "فراموشی رمز؟" : "Forgot password?"}</Link></div>
                <div className="relative"><input id="login-password" value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" dir="ltr" aria-invalid={Boolean(error) || undefined} className={`vd-focus vd-auth-field pe-14 ${error ? "border-vd-danger" : "border-vd-line"}`} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? (isFa ? "مخفی کردن رمز" : "Hide password") : (isFa ? "نمایش رمز" : "Show password")} className="vd-focus absolute inset-y-0 end-1 my-auto flex h-11 w-11 items-center justify-center rounded-full text-vd-muted"><EyeIcon off={showPassword} /></button></div>
              </div>
              <button type="submit" disabled={busy} className="vd-focus vd-auth-submit">{emailLoading ? (isFa ? "در حال ورود…" : "Signing in…") : (isFa ? "ورود به حساب" : "Sign in")}</button>
            </form>
          ) : null}
          {info ? <p role="status" className="vd-auth-feedback rounded-control bg-jade-tint p-3 text-sm font-semibold leading-6 text-jade">{info}</p> : null}
          {error ? <p role="alert" className="vd-auth-feedback rounded-control bg-vd-danger-tint p-3 text-sm font-semibold leading-6 text-vd-danger">{error}</p> : null}
          {googleAvailable ? <><div className="mb-[-4px] mt-5 flex items-center gap-7 text-sm font-medium text-vd-muted"><span className="h-px flex-1 bg-vd-line" />{isFa ? "یا" : "or"}<span className="h-px flex-1 bg-vd-line" /></div><GoogleIdentityButton locale={locale} onCredential={handleGoogle} />{googleLoading ? <p role="status" className="mt-2 text-center text-sm leading-7 text-vd-muted">{isFa ? "در حال ورود…" : "Signing in…"}</p> : null}</> : null}
          {mode === "phone" ? <p className="vd-auth-account-notice rounded-control bg-surface-soft p-[16px] text-[13px] font-medium leading-6 text-vd-muted">{copy.accountNotice}</p> : null}
          <p className="vd-auth-alternate flex flex-wrap items-center justify-center gap-x-2 text-sm font-medium leading-7 text-vd-muted">{registering ? copy.registered : isFa ? "حساب ندارید؟" : "Don't have an account?"}<Link href={alternateHref} className="vd-focus inline-flex min-h-11 items-center rounded-sm font-bold text-jade">{registering ? copy.signIn : isFa ? "ثبت‌نام کنید" : "Create one"}</Link></p>
          <p className="vd-auth-privacy">{copy.privacy}</p>
        </div>
        <LoginBenefits locale={locale} checkout={checkout} wordmark={storeProfile.logoUrl ? <Image unoptimized width={240} height={64} className="h-16 max-w-full object-contain" src={resolveApiImageUrl(storeProfile.logoUrl)} alt={brand.name} /> : brand.wordmark} />
      </div>
    </section>
  );
}

function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) { return <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-bold text-ink">{label}</label>; }

function normalizeDigits(value = "") { return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))); }

/** Accepts locale-local destinations, including filters, without allowing external or auth-loop redirects. */
function safeReturnTo(value: string | undefined, locale: Locale) {
  const fallback = withLocalePath("/account", locale);
  if (!value || !value.startsWith("/") || value.includes("\\") || value.includes("//") || /[\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://vendora.invalid");
    if (url.origin !== "https://vendora.invalid" || !(url.pathname === `/${locale}` || url.pathname.startsWith(`/${locale}/`))
      || new RegExp(`^/${locale}/(login|register)(/|$)`).test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

/** Normalizes Iranian prefix and separators without accepting arbitrary country codes. */
function normalizePhone(value: string) {
  return normalizeDigits(value).replace(/[\s-]/g, "").replace(/^(?:\+98|0098|98)(?=9)/, "0");
}

/** Requires explicit first/surname values; mirrors the server's bounded, non-control name validation. */
function validFullName(value: string) {
  const parts = value.trim().split(/\s+/);
  const names = [parts[0], parts.slice(1).join(" ")];
  return names.every(name => Boolean(name) && name.length <= 100 && /\p{L}/u.test(name) && !/[\u0000-\u001f\u007f]/.test(name));
}

function adapterMessage(message: string | undefined, fallback: string, unavailable: string) {
  if (message && /^[A-Z_]+$/.test(message)) return smsErrorMessage(message, /[\u0600-\u06ff]/.test(fallback));
  return message === "AUTH_ADAPTER_UNAVAILABLE" ? unavailable : message ?? fallback;
}

function persistAdapterAccount(account: AuthAccount, dispatch: (action: ReturnType<typeof userLoggedIn>) => void) {
  const user = { _id: account.user.id, id: account.user.id, name: account.user.name, email: account.user.email, phone: account.user.phone, role: account.user.role, completion: account.user.completion };
  localStorage.setItem("auth", JSON.stringify({ accessToken: account.accessToken, user }));
  dispatch(userLoggedIn({ accessToken: account.accessToken, user }));
}

function persistGoogleAccount(account: { id: string; fullName: string; email: string; role?: string; phoneNumber?: string; token: string; completion?: ProfileCompletion },
  dispatch: (action: ReturnType<typeof userLoggedIn>) => void) {
  const user = { _id: account.id, id: account.id, name: account.fullName, email: account.email, phone: account.phoneNumber, role: account.role, completion: account.completion };
  localStorage.setItem("auth", JSON.stringify({ accessToken: account.token, user }));
  dispatch(userLoggedIn({ accessToken: account.token, user }));
}
