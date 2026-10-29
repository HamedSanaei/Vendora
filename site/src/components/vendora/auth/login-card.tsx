"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { useLoginUserMutation } from "@/redux/features/auth/authApi";
import { userLoggedIn } from "@/redux/features/auth/authSlice";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { type AuthAccount, type PhoneAuthAdapter } from "@/lib/auth/auth-adapter";
import { notifySuccess } from "@/utils/toast";
import { CheckoutContextNotice, LoginModeTabs, OtpInput, PhoneField, type LoginMode } from "./login-components";
import { GoogleIdentityButton } from "./google-identity-button";
import { http } from "@/lib/http";
import axios from "axios";
import { storePresentation, useStoreSettings } from '../layout/store-settings-provider';
import { resolveApiImageUrl } from '@/lib/http';
import { completeProfileHref, type ProfileCompletion } from '@/lib/auth/customer-profile';
import { googleErrorMessage } from '@/lib/auth/google-errors';

import { createPhoneAuthAdapter, smsCapabilities, smsErrorMessage } from "@/lib/sms-client";
import { createSmsCodeAutofill } from '@/lib/auth/sms-code-autofill';

type PhoneStep = "identifier" | "otp";

interface LoginCardProps {
  locale: Locale;
  returnTo?: string;
  phoneAdapter?: PhoneAuthAdapter;

}

/** Penpot-aligned responsive login card with email, phone OTP and Google modes. */
export function LoginCard({ locale, returnTo, phoneAdapter }: LoginCardProps) {
  const isFa = locale === "fa";
  const storeProfile = useStoreSettings();
  const brand = storePresentation(storeProfile, locale);
  const router = useRouter();
  const dispatch = useDispatch();
  const [loginUser, { isLoading: emailLoading }] = useLoginUserMutation();
  const [mode, setMode] = useState<LoginMode>("email");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("identifier");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(120);
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
  const [smsEnabled, setSmsEnabled] = useState(false);
  const phoneAvailable = Boolean(phoneAdapter) || smsEnabled;
  useEffect(() => { const abort = new AbortController(); smsCapabilities(abort.signal).then(value => setSmsEnabled(value.phoneLogin)).catch(() => { if (!abort.signal.aborted) setSmsEnabled(false); }); return () => abort.abort(); }, []);
  const googleAvailable = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

  useEffect(() => {
    if (phoneStep !== "otp" || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phoneStep, secondsLeft]);

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

  const requestCode = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setInfo("");
    const normalizedPhone = normalizeDigits(phone);
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
      setError(adapterMessage(result.message, isFa ? "ارسال کد انجام نشد." : "The code could not be sent.", isFa ? "ورود با کد پیامکی هنوز به سرویس پیامک متصل نشده است." : "Phone sign-in is not connected to an SMS service yet."));
      return;
    }
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
    const result = await adapter.verifyCode(normalizeDigits(phone), code);
    setPhoneLoading(false);
    if (!result.ok || !result.account) {
      setError(adapterMessage(result.message, secondsLeft === 0 ? (isFa ? "کد منقضی شده است." : "The code has expired.") : (isFa ? "کد واردشده صحیح نیست." : "The code is incorrect."), isFa ? "تأیید کد پیامکی هنوز به سرویس احراز هویت متصل نشده است." : "Phone verification is not connected to an auth service yet."));
      return;
    }
    persistAdapterAccount(result.account, dispatch);
    notifySuccess(isFa ? "با موفقیت وارد شدید." : "You are signed in.");
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

  return (
    <section className="vd-root min-h-[calc(100vh-132px)] bg-surface-soft px-4 py-8 md:px-8 md:py-12" dir={isFa ? "rtl" : "ltr"}>
      <div className="mx-auto w-full max-w-[520px]">
        <div className="rounded-[24px] border border-vd-line bg-white p-5 shadow-[0_24px_70px_-45px_rgba(0,77,58,.65)] md:p-8">
          <div className="text-center"><span className="text-[26px] font-extrabold tracking-tight text-ink">{storeProfile.logoUrl ? <Image unoptimized width={180} height={48} className="mx-auto h-12 max-w-[180px] object-contain" src={resolveApiImageUrl(storeProfile.logoUrl)} alt={brand.name} /> : brand.wordmark}</span><h2 className="mt-7 text-2xl font-extrabold text-ink">{isFa ? "ورود به حساب کاربری" : "Sign in to your account"}</h2><p className="mt-2 text-sm leading-7 text-vd-muted">{mode === "phone" ? (isFa ? "با کد پیامکی وارد شوید یا حساب بسازید." : "Sign in or register using an SMS code.") : (isFa ? "با ایمیل و رمز عبور خود وارد شوید." : "Enter your email and password.")}</p></div>
          {destination.includes("/shipping") ? <CheckoutContextNotice locale={locale} /> : null}
          {phoneAvailable ? <LoginModeTabs locale={locale} mode={mode} onChange={changeMode} /> : null}

          {mode === "phone" && phoneStep === "identifier" ? <form onSubmit={requestCode} className="mt-6"><PhoneField locale={locale} value={phone} onChange={setPhone} invalid={Boolean(error)} /><button type="submit" disabled={phoneLoading} className="vd-focus mt-5 flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{phoneLoading ? (isFa ? "در حال ارسال…" : "Sending…") : (isFa ? "ارسال کد ورود" : "Send sign-in code")}</button></form> : null}
          {mode === "phone" && phoneStep === "otp" ? <form onSubmit={verifyCode} className="mt-6"><p className="text-sm font-semibold text-vd-muted">{isFa ? "کد ارسال‌شده به" : "Code sent to"} <bdi dir="ltr" className="font-extrabold text-ink">{phone}</bdi></p><OtpInput locale={locale} digits={otp} invalid={Boolean(error)} setInputRef={(index, element) => { otpRefs.current[index] = element; }} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} /><button type="submit" disabled={phoneLoading} className="vd-focus mt-5 flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{phoneLoading ? (isFa ? "در حال بررسی…" : "Verifying…") : (isFa ? "تأیید و ورود" : "Verify and sign in")}</button><div className="mt-4 flex items-center justify-between gap-3 text-xs"><button type="button" onClick={() => { autofill.cancel(); setPhoneStep("identifier"); setError(""); }} className="vd-focus rounded-sm font-bold text-jade">{isFa ? "ویرایش شماره" : "Edit number"}</button>{secondsLeft > 0 ? <span className="text-vd-muted">{isFa ? `${secondsLeft} ثانیه تا ارسال مجدد` : `Resend in ${secondsLeft}s`}</span> : <button type="button" onClick={() => void requestCode()} className="vd-focus rounded-sm font-bold text-jade">{isFa ? "ارسال مجدد" : "Resend code"}</button>}</div></form> : null}
          {mode === "email" ? <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4"><div><FieldLabel htmlFor="login-email" label={isFa ? "ایمیل" : "Email"} /><input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" dir="ltr" placeholder="name@example.com" className={`vd-focus h-[52px] w-full rounded-control border bg-white px-4 text-sm text-ink outline-none ${error ? "border-vd-danger" : "border-vd-line"}`} /></div><div><div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="login-password" label={isFa ? "رمز عبور" : "Password"} /><Link href={withLocalePath("/forgot", locale)} className="vd-focus text-xs font-bold text-jade">{isFa ? "فراموشی رمز؟" : "Forgot password?"}</Link></div><div className="relative"><input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} dir="ltr" className={`vd-focus h-[52px] w-full rounded-control border bg-white px-4 pe-12 text-sm text-ink outline-none ${error ? "border-vd-danger" : "border-vd-line"}`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (isFa ? "مخفی کردن رمز" : "Hide password") : (isFa ? "نمایش رمز" : "Show password")} className="vd-focus absolute inset-y-0 end-2 my-auto flex h-10 w-10 items-center justify-center rounded-full text-vd-muted">{showPassword ? "◉" : "○"}</button></div></div><button type="submit" disabled={emailLoading} className="vd-focus flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{emailLoading ? (isFa ? "در حال ورود…" : "Signing in…") : (isFa ? "ورود به حساب" : "Sign in")}</button><p className="font-sans text-center text-base font-medium leading-8 text-vd-muted">{isFa ? "حساب ندارید؟" : "Don't have an account?"} <Link href={withLocalePath("/register", locale)} className="vd-focus inline-flex min-h-11 items-center rounded-sm font-bold text-jade">{isFa ? "ثبت‌نام کنید" : "Create one"}</Link></p></form> : null}

          {googleAvailable ? <><div className="my-6 flex items-center gap-3 font-sans text-base font-medium text-vd-muted"><span className="h-px flex-1 bg-vd-line" />{isFa ? "یا" : "or"}<span className="h-px flex-1 bg-vd-line" /></div><GoogleIdentityButton locale={locale} onCredential={handleGoogle} />{googleLoading ? <p role="status" className="mt-2 font-sans text-center text-base leading-7 text-vd-muted">{isFa ? "در حال ورود…" : "Signing in…"}</p> : null}</> : null}
          {info ? <p role="status" className="mt-4 rounded-control bg-jade-tint p-3 text-center text-xs font-semibold leading-6 text-jade">{info}</p> : null}{error ? <p role="alert" className="mt-4 rounded-control bg-vd-danger-tint p-3 text-center text-xs font-semibold leading-6 text-vd-danger">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) { return <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-bold text-ink">{label}</label>; }

function normalizeDigits(value = "") { return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))); }

function safeReturnTo(value: string | undefined, locale: Locale) {
  const fallback = withLocalePath("/account", locale);
  if (!value || !(value === `/${locale}` || value.startsWith(`/${locale}/`)) || value.includes("\\") || value.includes("//") || /[?#]/.test(value)) return fallback;
  return value;
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
