"use client";

import type { ClipboardEvent, KeyboardEvent } from "react";
import type { Locale } from "@/lib/vendora/types";
import { getDict } from "@/lib/vendora/i18n";
import { ArrowEndIcon, CheckIcon } from "../icons";
import type { ReactNode } from "react";

export type LoginMode = "phone" | "email";

interface LoginModeTabsProps {
  locale: Locale;
  mode: LoginMode;
  onChange: (mode: LoginMode) => void;
  disabled?: boolean;
}

/** Accessible mode switch shared by every state of the login card. */
export function LoginModeTabs({ locale, mode, onChange, disabled }: LoginModeTabsProps) {
  const isFa = locale === "fa";
  return (
    <div className="mt-6 grid grid-cols-2 rounded-control bg-surface-soft p-[2px]" role="tablist" aria-label={isFa ? "روش ورود" : "Sign-in method"}>
      <button type="button" role="tab" disabled={disabled} aria-selected={mode === "phone"} onClick={() => onChange("phone")} className={`vd-focus min-h-11 rounded-[10px] text-sm font-bold ${mode === "phone" ? "bg-white text-jade shadow-sm" : "text-vd-muted"}`}>
        {isFa ? "شماره موبایل" : "Phone"}
      </button>
      <button type="button" role="tab" disabled={disabled} aria-selected={mode === "email"} onClick={() => onChange("email")} className={`vd-focus min-h-11 rounded-[10px] text-sm font-bold ${mode === "email" ? "bg-white text-jade shadow-sm" : "text-vd-muted"}`}>
        {isFa ? "ایمیل و رمزعبور" : "Email & password"}
      </button>
    </div>
  );
}

/** Checkout return notice used when authentication interrupts the purchase flow. */
export function CheckoutContextNotice({ locale }: { locale: Locale }) {
  return <div className="vd-auth-context">
    <div><p className="text-[12px] font-semibold leading-6 text-jade">{locale === "fa" ? "پس از ورود به اطلاعات ارسال بازمی‌گردید." : "After sign-in, you will return to shipping details."}</p><p className="text-[11px] leading-5 text-vd-muted">{getDict(locale).auth.checkoutTrail}</p></div>
    <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-jade md:flex"><ArrowEndIcon size={18} /></span>
  </div>;
}

interface PhoneFieldProps {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Iranian mobile field with the stable identifier-step layout. */
export function PhoneField({ locale, value, onChange, invalid = false }: PhoneFieldProps) {
  const isFa = locale === "fa";
  return (
    <div>
      <label htmlFor="login-phone" className="mb-2 block text-[13px] font-bold text-ink">{isFa ? "شماره موبایل" : "Mobile number"}</label>
      <input id="login-phone" type="tel" value={value} onChange={(event) => onChange(event.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="0912 123 4567" aria-invalid={invalid || undefined} className={`vd-auth-field vd-focus ${invalid ? "border-vd-danger" : "border-vd-line"}`} />
    </div>
  );
}

/** Penpot's existing desktop/tablet brand panel; mobile retains only the shared form. */
export function LoginBenefits({ locale, wordmark, checkout }: { locale: Locale; wordmark: ReactNode; checkout: boolean }) {
  const copy = getDict(locale).auth;
  const benefits = [checkout ? copy.benefitShipping : copy.benefitAccount, copy.benefitCart, copy.benefitOrders, copy.benefitSupport];
  return <aside className="vd-auth-benefits" aria-label={copy.eyebrow}>
    <div className="vd-auth-wordmark">{wordmark}</div>
    <h2 className="text-xl font-extrabold leading-9 text-jade">{copy.benefitsTitle}</h2>
    <div className="vd-auth-benefits-detail">
      <p className="text-sm font-medium leading-7 text-vd-muted">{copy.benefitsIntro}</p>
      <ul className="vd-auth-benefits-list">{benefits.map((benefit, index) => <li key={benefit} className={`flex items-start gap-2 text-sm font-bold leading-7 ${index === 0 ? "text-jade" : "text-ink"}`}><CheckIcon size={18} className="mt-1 shrink-0" />{benefit}</li>)}</ul>
      <blockquote className="vd-auth-quote">{copy.quote}</blockquote>
    </div>
  </aside>;
}

interface OtpInputProps {
  locale: Locale;
  digits: string[];
  invalid?: boolean;
  setInputRef: (index: number, element: HTMLInputElement | null) => void;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

/** Provider-length OTP input with paste, focus and backspace hooks owned by LoginCard. */
export function OtpInput({ locale, digits, invalid = false, setInputRef, onChange, onKeyDown, onPaste }: OtpInputProps) {
  const isFa = locale === "fa";
  return (
    <div className="mt-4 flex justify-center gap-2" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => setInputRef(index, element)}
          value={digit}
          onChange={(event) => onChange(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={index === 0 ? digits.length : 1}
          aria-label={`${isFa ? "رقم" : "Digit"} ${index + 1}`}
          aria-invalid={invalid || undefined}
          className={`vd-focus h-12 w-full min-w-0 max-w-12 rounded-control border text-center text-lg font-extrabold text-ink outline-none ${invalid ? "border-vd-danger" : "border-vd-line"}`}
        />
      ))}
    </div>
  );
}

interface GoogleButtonProps {
  locale: Locale;
  loading: boolean;
  onClick: () => void;
}

/** Reusable Google adapter trigger with loading and keyboard states. */
export function GoogleButton({ locale, loading, onClick }: GoogleButtonProps) {
  const isFa = locale === "fa";
  return (
    <button type="button" onClick={onClick} disabled={loading} className="vd-focus flex h-12 w-full items-center justify-center gap-3 rounded-control border border-vd-line bg-white text-sm font-extrabold text-ink hover:border-jade disabled:opacity-60">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-vd-line text-sm font-extrabold text-[#4285F4]">G</span>
      {loading ? (isFa ? "در حال اتصال…" : "Connecting…") : (isFa ? "ادامه با Google" : "Continue with Google")}
    </button>
  );
}
