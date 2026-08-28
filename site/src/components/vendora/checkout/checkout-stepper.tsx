"use client";

import { Fragment } from "react";
import { CheckIcon } from "@/components/vendora/icons";
import { formatNumber } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";

export type CheckoutStep = "cart" | "shipping" | "payment";

export interface CheckoutStepperProps {
  /** Current step; all completed and upcoming states are derived from it. */
  activeStep: CheckoutStep;
  /** Controls labels, number formatting and visual direction. */
  locale: Locale;
  className?: string;
}

interface StepDefinition {
  key: CheckoutStep;
  label: Record<Locale, string>;
  shortLabel: Record<Locale, string>;
}

const steps: readonly StepDefinition[] = [
  {
    key: "cart",
    label: { fa: "سبد خرید", en: "Cart" },
    shortLabel: { fa: "سبد", en: "Cart" },
  },
  {
    key: "shipping",
    label: { fa: "اطلاعات ارسال", en: "Shipping" },
    shortLabel: { fa: "ارسال", en: "Ship" },
  },
  {
    key: "payment",
    label: { fa: "پرداخت", en: "Payment" },
    shortLabel: { fa: "پرداخت", en: "Pay" },
  },
] as const;

/**
 * Responsive checkout progress indicator shared by every checkout page.
 * Connectors are separate grid cells, so they cannot overlap step circles or labels.
 */
export function CheckoutStepper({ activeStep, locale, className = "" }: CheckoutStepperProps) {
  const activeIndex = steps.findIndex((step) => step.key === activeStep);
  const isRtl = locale === "fa";

  return (
    <nav
      aria-label={isRtl ? "مراحل تکمیل خرید" : "Checkout progress"}
      dir={isRtl ? "rtl" : "ltr"}
      className={`vd-checkout-stepper ${className}`}
    >
      <ol className="grid h-[88px] grid-cols-[32px_minmax(0,1fr)_32px_minmax(0,1fr)_32px] items-start overflow-hidden rounded-[14px] border border-vd-line bg-jade-tint !px-[32px] !py-[16px] md:h-[112px] md:grid-cols-[44px_minmax(0,1fr)_44px_minmax(0,1fr)_44px] md:rounded-[18px] md:!px-[56px] md:!py-[20px]">
        {steps.map((step, index) => {
          const state = index < activeIndex
            ? "completed"
            : index === activeIndex
              ? "active"
              : "upcoming";
          const isActive = state === "active";
          const isCompleted = state === "completed";

          return (
            <Fragment key={step.key}>
              <li
                data-step={step.key}
                data-state={state}
                aria-current={isActive ? "step" : undefined}
                className="flex w-[32px] min-w-0 flex-col items-center md:w-[44px]"
              >
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-extrabold md:h-11 md:w-11 md:text-sm ${
                    isActive
                      ? "border-jade bg-jade text-white"
                      : "border-vd-line bg-white text-vd-muted"
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon size={16} className="text-jade md:h-[18px] md:w-[18px]" />
                  ) : (
                    formatNumber(index + 1, locale)
                  )}
                </span>

                <span
                  className={`mt-2 block w-20 max-w-none whitespace-nowrap text-center text-[10px] font-extrabold leading-4 md:mt-1.5 md:w-[150px] md:text-sm md:leading-[22px] ${
                    isActive ? "text-jade" : "text-vd-muted"
                  }`}
                >
                  <span className="sm:hidden">{step.shortLabel[locale]}</span>
                  <span className="hidden sm:inline">{step.label[locale]}</span>
                </span>

                <span className="sr-only">
                  {isRtl
                    ? state === "completed"
                      ? "تکمیل‌شده"
                      : state === "active"
                        ? "مرحله جاری"
                        : "مرحله بعدی"
                    : state}
                </span>
              </li>

              {index < steps.length - 1 ? (
                <li
                  role="presentation"
                  aria-hidden="true"
                  data-connector={`${step.key}-${steps[index + 1].key}`}
                  data-state={index < activeIndex ? "completed" : "upcoming"}
                  className={`mx-[16px] mt-[15px] h-0.5 min-w-0 md:mx-[18px] md:mt-[21px] ${
                    index < activeIndex ? "bg-[#9FD8C7]" : "bg-[#C7DAD3]"
                  }`}
                />
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
