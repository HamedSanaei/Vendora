"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { useLoginUserMutation } from "@/redux/features/auth/authApi";
import { userLoggedIn } from "@/redux/features/auth/authSlice";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { unavailableAuthAdapter, type AuthAccount, type GoogleAuthAdapter, type PhoneAuthAdapter } from "@/lib/auth/auth-adapter";
import { notifySuccess } from "@/utils/toast";
import { CheckoutContextNotice, GoogleButton, LoginModeTabs, OtpInput, PhoneField, type LoginMode } from "./login-components";

type PhoneStep = "identifier" | "otp";

interface LoginCardProps {
  locale: Locale;
  returnTo?: string;
  phoneAdapter?: PhoneAuthAdapter;
  googleAdapter?: GoogleAuthAdapter;
}

/** Penpot-aligned responsive login card with email, phone OTP and Google modes. */
export function LoginCard({ locale, returnTo, phoneAdapter = unavailableAuthAdapter, googleAdapter = unavailableAuthAdapter }: LoginCardProps) {
  const isFa = locale === "fa";
  const router = useRouter();
  const dispatch = useDispatch();
  const [loginUser, { isLoading: emailLoading }] = useLoginUserMutation();
  const [mode, setMode] = useState<LoginMode>("phone");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("identifier");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const destination = safeReturnTo(returnTo, locale);

  useEffect(() => {
    if (phoneStep !== "otp" || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phoneStep, secondsLeft]);

  const changeMode = (nextMode: LoginMode) => {
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
    const result = await loginUser({ email: email.trim(), password }) as { error?: { data?: { message?: string; error?: string } } };
    if (result?.error) {
      setError(result.error?.data?.message ?? result.error?.data?.error ?? (isFa ? "ورود ناموفق بود." : "Login failed."));
      return;
    }
    void remember;
    notifySuccess(isFa ? "با موفقیت وارد شدید." : "You are signed in.");
    router.push(destination);
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
    const result = await phoneAdapter.requestCode(normalizedPhone);
    setPhoneLoading(false);
    if (!result.ok) {
      setError(adapterMessage(result.message, isFa ? "ارسال کد انجام نشد." : "The code could not be sent.", isFa ? "ورود با کد پیامکی هنوز به سرویس پیامک متصل نشده است." : "Phone sign-in is not connected to an SMS service yet."));
      return;
    }
    setSecondsLeft(result.retryAfter ?? 120);
    setOtp(["", "", "", "", ""]);
    setPhoneStep("otp");
    setInfo(isFa ? "کد ورود برای شما ارسال شد." : "A sign-in code was sent to your phone.");
    window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const code = otp.join("");
    if (!/^\d{5}$/.test(code)) {
      setError(isFa ? "کد پنج‌رقمی را کامل وارد کنید." : "Enter the 5-digit code.");
      return;
    }
    setPhoneLoading(true);
    const result = await phoneAdapter.verifyCode(normalizeDigits(phone), code);
    setPhoneLoading(false);
    if (!result.ok || !result.account) {
      setError(adapterMessage(result.message, secondsLeft === 0 ? (isFa ? "کد منقضی شده است." : "The code has expired.") : (isFa ? "کد واردشده صحیح نیست." : "The code is incorrect."), isFa ? "تأیید کد پیامکی هنوز به سرویس احراز هویت متصل نشده است." : "Phone verification is not connected to an auth service yet."));
      return;
    }
    persistAdapterAccount(result.account, dispatch);
    notifySuccess(isFa ? "با موفقیت وارد شدید." : "You are signed in.");
    router.push(destination);
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const result = await googleAdapter.signIn();
    setGoogleLoading(false);
    if (!result.ok || !result.account) {
      setError(adapterMessage(result.message, isFa ? "ورود با Google انجام نشد." : "Google sign-in failed.", isFa ? "ورود با Google هنوز به سرویس OAuth متصل نشده است." : "Google sign-in is not connected to an OAuth service yet."));
      return;
    }
    persistAdapterAccount(result.account, dispatch);
    notifySuccess(isFa ? "با حساب Google وارد شدید." : "Signed in with Google.");
    router.push(destination);
  };

  const handleOtpChange = (index: number, value: string) => {
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
    const pasted = normalizeDigits(event.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 5).split("");
    if (!pasted.length) return;
    setOtp([...pasted, ...["", "", "", "", ""].slice(pasted.length)]);
    otpRefs.current[Math.min(pasted.length, 5) - 1]?.focus();
  };

  return (
    <section className="vd-root min-h-[calc(100vh-132px)] bg-surface-soft px-4 py-8 md:px-8 md:py-12" dir={isFa ? "rtl" : "ltr"}>
      <div className="mx-auto grid w-full max-w-[1120px] items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-10">
        <aside className="hidden rounded-[28px] bg-jade p-10 text-white lg:flex lg:flex-col lg:justify-between"><div><p className="text-sm font-bold text-jade-glow">VENDORA / AUTH</p><h1 className="mt-6 text-[40px] font-extrabold leading-[1.45]">{isFa ? "خرید خوب، از ورود ساده شروع می‌شود." : "A better purchase starts with a simple sign-in."}</h1><p className="mt-5 max-w-md text-sm leading-8 text-on-dark-soft">{isFa ? "آدرس‌ها، سبد خرید و پیگیری سفارش‌ها را یکجا و امن مدیریت کنید." : "Keep your addresses, cart and orders together in one secure account."}</p></div><ul className="space-y-4 text-sm font-semibold text-on-dark-soft"><li>✓ {isFa ? "سبد خرید شما حفظ می‌شود" : "Your cart stays with you"}</li><li>✓ {isFa ? "ارسال قابل پیگیری" : "Trackable delivery"}</li><li>✓ {isFa ? "پشتیبانی واقعی وندورا" : "Real Vendora support"}</li></ul></aside>
        <div className="rounded-[24px] border border-vd-line bg-white p-5 shadow-[0_24px_70px_-45px_rgba(0,77,58,.65)] md:p-8">
          <div className="text-center"><span className="text-[26px] font-extrabold tracking-tight text-ink">VENDORA</span><p className="mt-1 text-xs font-semibold text-jade">{isFa ? "وندورا" : "Bag manufacturer"}</p><h2 className="mt-7 text-2xl font-extrabold text-ink">{isFa ? "خوش آمدید" : "Welcome back"}</h2><p className="mt-2 text-sm leading-7 text-vd-muted">{isFa ? "برای ادامه، یکی از روش‌های ورود را انتخاب کنید." : "Choose a sign-in method to continue."}</p></div>
          {destination.includes("/shipping") ? <CheckoutContextNotice locale={locale} /> : null}
          <LoginModeTabs locale={locale} mode={mode} onChange={changeMode} />

          {mode === "phone" && phoneStep === "identifier" ? <form onSubmit={requestCode} className="mt-6"><PhoneField locale={locale} value={phone} onChange={setPhone} invalid={Boolean(error)} /><button type="submit" disabled={phoneLoading} className="vd-focus mt-5 flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{phoneLoading ? (isFa ? "در حال ارسال…" : "Sending…") : (isFa ? "ارسال کد ورود" : "Send sign-in code")}</button></form> : null}
          {mode === "phone" && phoneStep === "otp" ? <form onSubmit={verifyCode} className="mt-6"><p className="text-sm font-semibold text-vd-muted">{isFa ? "کد ارسال‌شده به" : "Code sent to"} <bdi dir="ltr" className="font-extrabold text-ink">{phone}</bdi></p><OtpInput locale={locale} digits={otp} invalid={Boolean(error)} setInputRef={(index, element) => { otpRefs.current[index] = element; }} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} /><button type="submit" disabled={phoneLoading} className="vd-focus mt-5 flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{phoneLoading ? (isFa ? "در حال بررسی…" : "Verifying…") : (isFa ? "تأیید و ورود" : "Verify and sign in")}</button><div className="mt-4 flex items-center justify-between gap-3 text-xs"><button type="button" onClick={() => { setPhoneStep("identifier"); setError(""); }} className="vd-focus rounded-sm font-bold text-jade">{isFa ? "ویرایش شماره" : "Edit number"}</button>{secondsLeft > 0 ? <span className="text-vd-muted">{isFa ? `${secondsLeft} ثانیه تا ارسال مجدد` : `Resend in ${secondsLeft}s`}</span> : <button type="button" onClick={() => void requestCode()} className="vd-focus rounded-sm font-bold text-jade">{isFa ? "ارسال مجدد" : "Resend code"}</button>}</div></form> : null}
          {mode === "email" ? <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4"><div><FieldLabel htmlFor="login-email" label={isFa ? "ایمیل" : "Email"} /><input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" dir="ltr" placeholder="name@example.com" className={`vd-focus h-[52px] w-full rounded-control border bg-white px-4 text-sm text-ink outline-none ${error ? "border-vd-danger" : "border-vd-line"}`} /></div><div><div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="login-password" label={isFa ? "رمز عبور" : "Password"} /><Link href={withLocalePath("/forgot", locale)} className="vd-focus text-xs font-bold text-jade">{isFa ? "فراموشی رمز؟" : "Forgot password?"}</Link></div><div className="relative"><input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} dir="ltr" className={`vd-focus h-[52px] w-full rounded-control border bg-white px-4 pe-12 text-sm text-ink outline-none ${error ? "border-vd-danger" : "border-vd-line"}`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? (isFa ? "مخفی کردن رمز" : "Hide password") : (isFa ? "نمایش رمز" : "Show password")} className="vd-focus absolute inset-y-0 end-2 my-auto flex h-10 w-10 items-center justify-center rounded-full text-vd-muted">{showPassword ? "◉" : "○"}</button></div></div><label className="flex min-h-11 items-center gap-3 text-xs font-semibold text-ink"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-5 w-5 accent-[var(--color-jade)]" />{isFa ? "مرا به خاطر بسپار" : "Remember me"}</label><button type="submit" disabled={emailLoading} className="vd-focus flex h-12 w-full items-center justify-center rounded-control bg-jade text-sm font-extrabold text-white hover:bg-jade-dark disabled:opacity-60">{emailLoading ? (isFa ? "در حال ورود…" : "Signing in…") : (isFa ? "ورود به حساب" : "Sign in")}</button><p className="text-center text-xs text-vd-muted">{isFa ? "حساب ندارید؟" : "Don't have an account?"} <Link href={withLocalePath("/register", locale)} className="vd-focus font-bold text-jade">{isFa ? "ثبت‌نام کنید" : "Create one"}</Link></p></form> : null}

          <div className="my-6 flex items-center gap-3 text-xs text-vd-muted"><span className="h-px flex-1 bg-vd-line" />{isFa ? "یا" : "or"}<span className="h-px flex-1 bg-vd-line" /></div><GoogleButton locale={locale} loading={googleLoading} onClick={() => void handleGoogle()} />
          {info ? <p role="status" className="mt-4 rounded-control bg-jade-tint p-3 text-center text-xs font-semibold leading-6 text-jade">{info}</p> : null}{error ? <p role="alert" className="mt-4 rounded-control bg-vd-danger-tint p-3 text-center text-xs font-semibold leading-6 text-vd-danger">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) { return <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-bold text-ink">{label}</label>; }

function normalizeDigits(value = "") { return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))); }

function safeReturnTo(value: string | undefined, locale: Locale) {
  const fallback = withLocalePath("/shipping", locale);
  if (!value || !value.startsWith(`/${locale}`) || value.startsWith("//") || value.includes("http")) return fallback;
  return value;
}

function adapterMessage(message: string | undefined, fallback: string, unavailable: string) {
  return message === "AUTH_ADAPTER_UNAVAILABLE" ? unavailable : message ?? fallback;
}

function persistAdapterAccount(account: AuthAccount, dispatch: (action: ReturnType<typeof userLoggedIn>) => void) {
  const user = { _id: account.user.id, id: account.user.id, name: account.user.name, email: account.user.email, phone: account.user.phone };
  localStorage.setItem("auth", JSON.stringify({ accessToken: account.accessToken, user }));
  dispatch(userLoggedIn({ accessToken: account.accessToken, user }));
}
