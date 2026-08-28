import Link from "next/link";
import type { ReactNode } from "react";
import Header from "@/layout/header";
import Footer from "@/layout/footer";
import type { Locale } from "@/lib/vendora/types";
import { CheckoutStepper, type CheckoutStep } from "./checkout-stepper";

interface CheckoutFlowLayoutProps {
  locale: Locale;
  children: ReactNode;
}

/** Shared storefront chrome for every page participating in the checkout flow. */
export function CheckoutFlowLayout({ locale, children }: CheckoutFlowLayoutProps) {
  return (
    <div className="vd-root min-h-screen bg-white" dir={locale === "fa" ? "rtl" : "ltr"}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}

interface CheckoutStageHeaderProps {
  locale: Locale;
  activeStep: CheckoutStep;
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/** Reusable page heading and the locked shared CheckoutStepper instance. */
export function CheckoutStageHeader({
  locale,
  activeStep,
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  className = "",
}: CheckoutStageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-jade">{eyebrow}</p>
          <h1 className="mt-2 text-[26px] font-extrabold leading-[1.45] text-ink md:text-[32px]">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-vd-muted">{description}</p>
        </div>
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="vd-focus hidden min-h-11 shrink-0 items-center justify-center rounded-control border border-vd-line px-4 text-xs font-bold text-vd-muted hover:border-jade hover:text-jade md:inline-flex"
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 md:mt-8">
        <CheckoutStepper activeStep={activeStep} locale={locale} />
      </div>
    </div>
  );
}

interface CheckoutStickyActionProps {
  label: string;
  value: string;
  action: ReactNode;
}

/** Safe-area-aware mobile checkout action shared by Cart, Shipping and Payment. */
export function CheckoutStickyAction({ label, value, action }: CheckoutStickyActionProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex min-h-[92px] items-center justify-between gap-4 border-t border-vd-line bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3 lg:hidden">
      <div className="min-w-0">
        <p className="text-xs text-vd-muted">{label}</p>
        <strong className="mt-1 block truncate text-base font-extrabold text-jade-dark">{value}</strong>
      </div>
      {action}
    </div>
  );
}
