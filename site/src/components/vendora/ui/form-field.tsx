"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Form field family from the Penpot account components:
 * label (13/600) + 52px control with 12px radius and #E5E7EB border.
 */

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

const controlClasses =
  "h-[52px] w-full rounded-control border border-vd-line bg-white px-4 text-sm text-ink placeholder:text-vd-muted vd-focus disabled:bg-surface-soft";

export function TextField({
  label,
  hint,
  error,
  className,
  ...input
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} className={`${controlClasses} ${error ? "border-vd-danger" : ""}`} {...input} />
      {hint && !error ? <p className="vd-text-caption mt-1.5 text-vd-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="vd-text-caption mt-1.5 text-vd-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  error,
  className,
  children,
  ...select
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
        {label}
      </label>
      <select
        id={id}
        className={`${controlClasses} appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-no-repeat [background-position:left_1rem_center] rtl:[background-position:right_1rem_center]`}
        {...select}
      >
        {children}
      </select>
      {error ? (
        <p role="alert" className="vd-text-caption mt-1.5 text-vd-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  rows = 4,
  ...textarea
}: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-control border border-vd-line bg-white px-4 py-3 text-sm text-ink placeholder:text-vd-muted vd-focus ${error ? "border-vd-danger" : ""}`}
        {...textarea}
      />
      {hint && !error ? <p className="vd-text-caption mt-1.5 text-vd-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="vd-text-caption mt-1.5 text-vd-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({
  label,
  error,
  className,
  ...input
}: BaseFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          className={`${controlClasses} pe-12 ${error ? "border-vd-danger" : ""}`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="vd-focus absolute inset-y-0 end-3 my-auto flex h-8 w-8 items-center justify-center rounded-full text-vd-muted hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" />
            <circle cx="12" cy="12" r="2.6" />
            {visible ? <path d="M5 5l14 14" /> : null}
          </svg>
        </button>
      </div>
      {error ? (
        <p role="alert" className="vd-text-caption mt-1.5 text-vd-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
