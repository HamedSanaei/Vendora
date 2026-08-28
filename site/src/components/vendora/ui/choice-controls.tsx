"use client";

import { useId } from "react";
import type { ReactNode } from "react";

/**
 * Choice controls from the Penpot account form components:
 * radio (54px pill), checkbox and the iOS-style default-address switch.
 */

interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
}

export function RadioOption({ name, value, checked, onChange, label }: RadioOptionProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`vd-focus flex min-h-[54px] cursor-pointer items-center gap-3 rounded-control border px-4 text-sm leading-7 transition-colors ${
        checked ? "border-jade bg-jade-tint font-semibold text-jade" : "border-vd-line bg-white text-ink hover:border-vd-muted"
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-[#006b4f]"
      />
      {label}
    </label>
  );
}

interface CheckboxOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}

export function CheckboxOption({ checked, onChange, label }: CheckboxOptionProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`vd-focus flex min-h-[54px] cursor-pointer items-center gap-3 rounded-control border px-4 text-sm leading-7 transition-colors ${
        checked ? "border-jade bg-jade-tint font-semibold text-jade" : "border-vd-line bg-white text-ink hover:border-vd-muted"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#006b4f]"
      />
      {label}
    </label>
  );
}

/** Compact inline checkbox (no card chrome), e.g. packaging question. */
export function InlineCheckbox({
  checked,
  onChange,
  label,
}: Omit<CheckboxOptionProps, "children"> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="vd-focus flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#006b4f]"
      />
      {label}
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`vd-focus relative h-10 w-[72px] rounded-full border transition-colors ${
          checked ? "border-jade bg-jade" : "border-vd-line bg-surface-soft"
        }`}
      >
        <span
          className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow-card transition-all ${
            checked ? "start-[calc(100%-2.25rem)]" : "start-1"
          }`}
        />
      </button>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold leading-7 text-ink">
          {label}
        </label>
      ) : null}
    </div>
  );
}
