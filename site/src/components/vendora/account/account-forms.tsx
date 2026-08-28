"use client";

import { useMemo, useState } from "react";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { formatNumber } from "@/lib/vendora/format";
import { useChangePasswordMutation } from "@/redux/features/auth/authApi";
import {
  CardPanel,
} from "./dashboard-cards";
import { PasswordField, TextField, SelectField, TextareaField } from "@/components/vendora/ui/form-field";
import { VendoraButton } from "@/components/vendora/ui/button";

/**
 * Profile details form (Penpot "Edit Profile" screen): two-column fields,
 * privacy notice band and save/cancel actions. Demo-only submission.
 */
export function ProfileForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [values, setValues] = useState({
    firstName: locale === "fa" ? "کاربر" : "Vendora",
    lastName: locale === "fa" ? "وندورا" : "User",
    email: "user@vendora.example",
    phone: "09121234567",
  });
  const [saved, setSaved] = useState(false);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="space-y-6"
    >
      <CardPanel>
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.account.profile.sectionTitle}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextField
            label={t.account.profile.firstName}
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
          />
          <TextField
            label={t.account.profile.lastName}
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
          />
          <TextField
            label={t.account.profile.email}
            type="email"
            dir="ltr"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
          <TextField
            label={t.account.profile.phone}
            type="tel"
            dir="ltr"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          />
        </div>

        <hr className="my-7 border-vd-line" />

        <div className="flex items-start gap-4 rounded-control bg-jade-tint p-5">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-jade">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5.5" y="10.5" width="13" height="9" rx="2.5" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
            </svg>
          </span>
          <div>
            <p className="text-[0.9375rem] font-bold text-ink">{t.account.profile.privacyTitle}</p>
            <p className="vd-text-caption mt-1 text-vd-muted">{t.account.profile.privacyBody}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-4">
          <VendoraButton variant="outline">{t.common.cancel}</VendoraButton>
          <VendoraButton type="submit">{t.common.save}</VendoraButton>
        </div>
        <p role="status" aria-live="polite" className={`vd-text-caption mt-4 text-vd-success ${saved ? "" : "hidden"}`}>
          {t.account.profile.saved}
        </p>
      </CardPanel>
    </form>
  );
}

type Strength = "weak" | "medium" | "strong";
type PasswordErrors = { current?: string; next?: string; confirm?: string };

interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  special: boolean;
}

function inspectPassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordErrorMessage(result: unknown, locale: Locale, security: ReturnType<typeof getDict>["account"]["security"]): string {
  const error = (result as { error?: { status?: number; data?: { message?: string } } })?.error;
  if (!error) return security.serverError;
  if (error.status === 401) return security.unauthorized;
  const message = error.data?.message ?? "";
  if (/incorrect password/i.test(message)) return security.currentInvalid;
  if (/current password is required/i.test(message)) return security.currentRequired;
  if (/new password is required/i.test(message)) return security.newRequired;
  if (/at least.*characters/i.test(message)) return security.newTooShort;
  if (/digit|non-alphanumeric|uppercase|lowercase/i.test(message)) return security.newClassesRequired;
  return locale === "en" ? message || security.serverError : security.serverError;
}

/**
 * Change-password form with a live password-strength meter, character-class
 * guidance, field validation, and the authenticated change-password request.
 */
export function PasswordForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const security = t.account.security;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const checks = useMemo(() => inspectPassword(next), [next]);
  const characterClassCount = useMemo(
    () => [checks.lowercase, checks.uppercase, checks.digit, checks.special].filter(Boolean).length,
    [checks]
  );
  const strength: Strength = useMemo(() => {
    if (!next) return "weak";
    if (checks.length && characterClassCount >= 4) return "strong";
    if (checks.length && characterClassCount >= 3) return "medium";
    return "weak";
  }, [characterClassCount, checks.length, next]);
  const meterSegments = !next ? 0 : strength === "strong" ? 3 : strength === "medium" ? 2 : 1;
  const barColor = strength === "strong" ? "bg-vd-success" : strength === "medium" ? "bg-vd-warning" : "bg-vd-danger";
  const strengthColor = strength === "strong" ? "text-vd-success" : strength === "medium" ? "text-vd-warning" : "text-vd-danger";
  const requirements = [
    ["length", checks.length],
    ["lowercase", checks.lowercase],
    ["uppercase", checks.uppercase],
    ["digit", checks.digit],
    ["special", checks.special],
  ] as const;

  const clearFeedback = () => {
    setUpdated(false);
    setApiError(null);
  };

  const resetForm = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setApiError(null);
    setUpdated(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    const nextErrors: PasswordErrors = {};
    if (!current) nextErrors.current = security.currentRequired;
    if (!next) nextErrors.next = security.newRequired;
    else if (!checks.length) nextErrors.next = security.newTooShort;
    else if (characterClassCount < 3) nextErrors.next = security.newClassesRequired;
    if (!confirm) nextErrors.confirm = security.confirmRequired;
    else if (next !== confirm) nextErrors.confirm = security.mismatch;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = await changePassword({ currentPassword: current, newPassword: next });
    if ((result as { error?: unknown })?.error) {
      setApiError(getPasswordErrorMessage(result, locale, security));
      return;
    }

    setUpdated(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <form noValidate onSubmit={handleSubmit}>
      <CardPanel>
        <h2 className="text-[1.1875rem] font-bold text-ink">{security.sectionTitle}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <PasswordField
            label={security.oldPassword}
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setErrors((value) => ({ ...value, current: undefined }));
              clearFeedback();
            }}
            error={errors.current}
            autoComplete="current-password"
          />
          <div className="rounded-control bg-surface-soft p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="vd-text-caption font-semibold text-ink">{security.strength.label}</p>
              <span className={`vd-text-caption font-bold ${next ? strengthColor : "text-vd-muted"}`}>{next ? security.strength[strength] : "—"}</span>
            </div>
            <div className="mt-3 flex gap-1.5" role="progressbar" aria-label={security.strength.label} aria-valuemin={0} aria-valuemax={3} aria-valuenow={meterSegments}>
              {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 flex-1 rounded-sm ${index < meterSegments ? barColor : "bg-vd-line"}`} />)}
            </div>
            <p className="vd-text-caption mt-3 font-semibold text-ink">{security.guidanceTitle}</p>
            <p className="vd-text-caption mt-1 text-vd-muted">{security.guidanceBody}</p>
            <p className={`vd-text-caption mt-2 font-semibold ${characterClassCount >= 3 ? "text-vd-success" : "text-vd-warning"}`}>
              {security.classesUsed(formatNumber(characterClassCount, locale))}
            </p>
            <ul className="mt-2 grid gap-1 text-xs" aria-label={security.guidanceTitle}>
              {requirements.map(([key, satisfied]) => (
                <li key={key} className={`flex items-center gap-2 ${satisfied ? "text-vd-success" : "text-vd-warning"}`}>
                  <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold">{satisfied ? "✓" : "!"}</span>
                  <span>{security.requirements[key]}</span>
                </li>
              ))}
            </ul>
            {next && characterClassCount < 3 ? <p role="alert" className="vd-text-caption mt-2 font-semibold text-vd-warning">{security.classesWarning}</p> : null}
          </div>
          <PasswordField
            label={security.newPassword}
            value={next}
            onChange={(event) => {
              setNext(event.target.value);
              setErrors((value) => ({ ...value, next: undefined }));
              clearFeedback();
            }}
            error={errors.next}
            autoComplete="new-password"
          />
          <PasswordField
            label={security.confirmPassword}
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setErrors((value) => ({ ...value, confirm: undefined }));
              clearFeedback();
            }}
            error={errors.confirm}
            autoComplete="new-password"
          />
        </div>

        {apiError ? <p role="alert" className="vd-text-caption mt-5 rounded-control bg-vd-danger-tint px-4 py-3 font-semibold text-vd-danger">{apiError}</p> : null}
        <div className="mt-7 flex flex-wrap justify-end gap-4">
          <VendoraButton type="button" variant="outline" onClick={resetForm} disabled={isLoading}>{t.common.cancel}</VendoraButton>
          <VendoraButton type="submit" disabled={isLoading}>{isLoading ? (locale === "fa" ? "در حال ذخیره…" : "Saving…") : t.common.save}</VendoraButton>
        </div>
        {updated ? <p role="status" aria-live="polite" className="vd-text-caption mt-4 text-vd-success">{security.updated}</p> : null}
      </CardPanel>
    </form>
  );
}

/** Shared export so address form can reuse the field primitives. */
export { TextField, SelectField, TextareaField };
