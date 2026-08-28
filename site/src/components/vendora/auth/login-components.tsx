"use client";

import type { ClipboardEvent, KeyboardEvent } from "react";
import type { Locale } from "@/lib/vendora/types";

export type LoginMode = "phone" | "email";

interface LoginModeTabsProps {
  locale: Locale;
  mode: LoginMode;
  onChange: (mode: LoginMode) => void;
}

/** Accessible mode switch shared by every state of the login card. */
export function LoginModeTabs({ locale, mode, onChange }: LoginModeTabsProps) {
  const isFa = locale === "fa";
  return (
    <div className="mt-6 grid grid-cols-2 rounded-control bg-surface-soft p-1" role="tablist" aria-label={isFa ? "روش ورود" : "Sign-in method"}>
      <button type="button" role="tab" aria-selected={mode === "phone"} onClick={() => onChange("phone")} className={`vd-focus min-h-11 rounded-[10px] text-sm font-bold ${mode === "phone" ? "bg-white text-jade shadow-sm" : "text-vd-muted"}`}>
        {isFa ? "شماره موبایل" : "Phone"}
      </button>
      <button type="button" role="tab" aria-selected={mode === "email"} onClick={() => onChange("email")} className={`vd-focus min-h-11 rounded-[10px] text-sm font-bold ${mode === "email" ? "bg-white text-jade shadow-sm" : "text-vd-muted"}`}>
        {isFa ? "ایمیل و رمزعبور" : "Email & password"}
      </button>
    </div>
  );
}

/** Checkout return notice used when authentication interrupts the purchase flow. */
export function CheckoutContextNotice({ locale }: { locale: Locale }) {
  return <div className="mt-5 rounded-control bg-jade-tint p-3 text-center text-xs font-semibold leading-6 text-jade">{locale === "fa" ? "پس از ورود به اطلاعات ارسال بازمی‌گردید." : "After sign-in, you will return to shipping details."}</div>;
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
      <input id="login-phone" value={value} onChange={(event) => onChange(event.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="0912 123 4567" aria-invalid={invalid || undefined} className={`vd-focus h-[52px] w-full rounded-control border bg-white px-4 text-sm text-ink outline-none ${invalid ? "border-vd-danger" : "border-vd-line"}`} />
      <p className="mt-2 text-xs text-vd-muted">{isFa ? "برای شماره‌های جدید، حساب پس از تأیید کد ساخته می‌شود." : "New numbers get an account after code verification."}</p>
    </div>
  );
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

/** Five-digit OTP input with paste, focus and backspace hooks owned by LoginCard. */
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
          maxLength={1}
          aria-label={`${isFa ? "رقم" : "Digit"} ${index + 1}`}
          aria-invalid={invalid || undefined}
          className={`vd-focus h-12 w-12 rounded-control border text-center text-lg font-extrabold text-ink outline-none ${invalid ? "border-vd-danger" : "border-vd-line"}`}
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
