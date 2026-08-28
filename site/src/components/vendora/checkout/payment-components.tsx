"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CreditCardIcon, PinIcon, TruckIcon, WarningIcon } from "@/components/vendora/icons";
import { VendoraButton } from "@/components/vendora/ui/button";
import { formatPrice } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";
import type {
  CheckoutComponentSize,
  CheckoutComponentState,
  CheckoutTotals,
  PaymentCheckoutPhase,
  PaymentProviderId,
} from "./checkout-model";

interface PaymentMethodCardProps {
  provider: PaymentProviderId;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
  state?: CheckoutComponentState;
  size?: CheckoutComponentSize;
}

/** Selectable payment provider card with the complete Penpot state contract. */
export function PaymentMethodCard({
  provider,
  locale,
  selected,
  onSelect,
  state = selected ? "selected" : "default",
  size = "regular",
}: PaymentMethodCardProps) {
  const isFa = locale === "fa";
  const disabled = state === "disabled";
  const error = state === "error";
  const active = selected || state === "selected" || state === "focus";
  const copy = provider === "zarinpal"
    ? {
        title: isFa ? "درگاه زرین‌پال" : "Zarinpal gateway",
        description: isFa ? "پرداخت امن با تمام کارت‌های بانکی" : "Secure payment with Iranian bank cards",
        badge: isFa ? "پیشنهادی" : "Recommended",
        mark: isFa ? "زرین‌پال" : "Zarinpal",
      }
    : {
        title: isFa ? "درگاه بانک ملی" : "Bank Melli gateway",
        description: isFa ? "انتقال امن به درگاه بانک ملی" : "Secure handoff to Bank Melli",
        badge: isFa ? "پرداخت آنلاین" : "Online payment",
        mark: isFa ? "بانک ملی" : "Bank Melli",
      };

  return (
    <label
      data-provider={provider}
      data-state={state}
      className={`vd-focus group relative flex min-h-[112px] cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors md:p-5 ${
        error
          ? "border-vd-danger bg-vd-danger-tint"
          : active
            ? "border-jade bg-jade-tint"
            : "border-vd-line bg-white hover:border-jade"
      } ${disabled ? "pointer-events-none cursor-not-allowed opacity-55" : ""} ${size === "compact" ? "md:min-h-[112px]" : "md:min-h-[116px]"}`}
    >
      <input
        type="radio"
        name="payment-provider"
        value={provider}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-jade bg-jade" : "border-vd-line bg-white"}`}
      >
        {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <strong className="text-[15px] font-extrabold text-ink md:text-[17px]">{copy.title}</strong>
          <span className={`rounded-[10px] px-3 py-2 text-[11px] font-extrabold ${provider === "zarinpal" ? "bg-[#FFF6E5] text-[#9A6700]" : "bg-vd-info-tint text-vd-info"}`}>{copy.mark}</span>
        </span>
        <span className="mt-2 block text-xs leading-6 text-vd-muted">{copy.description}</span>
        <span className={`mt-2 inline-flex text-[11px] font-bold ${error ? "text-vd-danger" : active ? "text-jade" : "text-vd-muted"}`}>
          {error ? (isFa ? "این درگاه اکنون در دسترس نیست" : "This gateway is currently unavailable") : copy.badge}
        </span>
      </span>
    </label>
  );
}

interface CheckoutReviewItemProps {
  type: "address" | "shipping";
  locale: Locale;
  title: string;
  description: string;
  meta?: string;
  editHref: string;
  warning?: boolean;
}

/** Compact review card shared by address and shipping summaries. */
export function CheckoutReviewItem({ type, locale, title, description, meta, editHref, warning = false }: CheckoutReviewItemProps) {
  const isFa = locale === "fa";
  return (
    <article className={`min-w-0 rounded-card border p-4 ${warning ? "border-vd-warning bg-vd-warning-tint" : "border-vd-line bg-white"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${warning ? "bg-white text-vd-warning" : "bg-jade-tint text-jade"}`}>
          {type === "address" ? <PinIcon size={20} /> : <TruckIcon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold ${warning ? "text-vd-warning" : "text-vd-muted"}`}>{type === "address" ? (isFa ? "آدرس تحویل" : "Delivery address") : (isFa ? "روش ارسال" : "Shipping method")}</p>
          <h3 className="mt-1 line-clamp-1 text-sm font-extrabold text-ink md:text-base">{title}</h3>
        </div>
      </div>
      <p className={`mt-3 line-clamp-2 text-xs leading-6 ${warning ? "text-vd-danger" : "text-vd-muted"}`}>{description}</p>
      {meta ? <p className="mt-1 text-xs font-semibold text-vd-muted">{meta}</p> : null}
      <Link href={editHref} className="vd-focus mt-3 inline-flex min-h-11 items-center rounded-sm text-xs font-extrabold text-jade hover:underline">
        {type === "address" ? (isFa ? "ویرایش اطلاعات ارسال" : "Edit shipping details") : (isFa ? "تغییر روش ارسال" : "Change shipping method")}
      </Link>
    </article>
  );
}

interface PaymentNoticeProps {
  locale: Locale;
  state: "warning" | "error";
  title?: string;
  children?: ReactNode;
}

/** Warning and error notice family used by VPN guidance and submit failures. */
export function PaymentNotice({ locale, state, title, children }: PaymentNoticeProps) {
  const isFa = locale === "fa";
  const error = state === "error";
  return (
    <div role={error ? "alert" : "note"} className={`flex items-start gap-3 rounded-[14px] border p-4 ${error ? "border-vd-danger bg-vd-danger-tint text-vd-danger" : "border-[#F2C94C] bg-vd-warning-tint text-vd-warning"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${error ? "bg-vd-danger" : "bg-vd-warning"}`}><WarningIcon size={20} /></span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{title ?? (error ? (isFa ? "ایجاد سفارش انجام نشد" : "Order creation failed") : (isFa ? "پیش از پرداخت VPN را خاموش کنید" : "Turn off your VPN before payment"))}</p>
        <div className="mt-1 text-xs leading-6">{children ?? (error ? (isFa ? "اتصال برقرار نشد؛ دوباره تلاش کنید." : "The request failed. Please try again.") : (isFa ? "روشن‌بودن VPN ممکن است باعث خطا در بازگشت از درگاه شود." : "A VPN can interrupt the return from the payment gateway."))}</div>
      </div>
    </div>
  );
}

interface PaymentSummaryProps {
  locale: Locale;
  totals: CheckoutTotals;
  shippingMethodTitle: string;
  provider?: PaymentProviderId | null;
  phase: PaymentCheckoutPhase;
  onSubmit: () => void;
  className?: string;
}

/** Financial summary for prepaid and collect shipping with loading/error states. */
export function PaymentSummary({ locale, totals, shippingMethodTitle, provider, phase, onSubmit, className = "" }: PaymentSummaryProps) {
  const isFa = locale === "fa";
  const busy = phase === "submitting" || phase === "redirecting";
  const disabled = busy || !provider;
  return (
    <aside data-state={phase} className={`rounded-[20px] border bg-white p-5 shadow-[0_18px_50px_-40px_rgba(0,77,58,.85)] lg:p-6 ${phase === "error" ? "border-vd-danger" : "border-vd-line"} ${className}`}>
      <h2 className="text-xl font-extrabold text-ink">{isFa ? "خلاصه پرداخت" : "Payment summary"}</h2>
      <hr className="my-5 border-vd-line" />
      <dl className="space-y-4 text-sm">
        <SummaryLine label={isFa ? "جمع کالاها" : "Items subtotal"} value={formatPrice(totals.subtotal, locale)} />
        <SummaryLine label={isFa ? "تخفیف" : "Discount"} value={`− ${formatPrice(totals.discount, locale)}`} muted />
        <SummaryLine label={isFa ? "روش ارسال" : "Shipping method"} value={shippingMethodTitle} />
        <SummaryLine label={isFa ? "هزینه ارسال" : "Shipping cost"} value={totals.shippingPayment === "collect" ? (isFa ? "پرداخت هنگام تحویل" : "Pay on delivery") : formatPrice(totals.shippingCost, locale)} accent={totals.shippingPayment === "collect"} />
      </dl>
      <hr className="my-5 border-vd-line" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-ink">{isFa ? "مبلغ قابل پرداخت" : "Payable now"}</span>
        <strong className="text-lg font-extrabold text-jade-dark">{formatPrice(totals.payable, locale)}</strong>
      </div>
      <p className={`mt-3 text-xs leading-6 ${phase === "error" ? "text-vd-danger" : "text-vd-muted"}`}>
        {phase === "error"
          ? (isFa ? "سفارش ایجاد نشد؛ اطلاعات شما حفظ شده است." : "The order was not created; your checkout data is preserved.")
          : totals.shippingPayment === "collect"
            ? (isFa ? "کرایه باربری به مبلغ آنلاین اضافه نمی‌شود." : "Freight charges are not included in the online total.")
            : (isFa ? "پس از ثبت سفارش، مرحلهٔ انتقال نمایش داده می‌شود." : "A payment handoff state appears after the order is created.")}
      </p>
      <VendoraButton type="button" size="lg" className="mt-5 w-full" disabled={disabled} onClick={onSubmit}>
        {phase === "submitting"
          ? (isFa ? "در حال ایجاد سفارش…" : "Creating order…")
          : phase === "redirecting"
            ? (isFa ? "در حال انتقال…" : "Redirecting…")
            : phase === "error"
              ? (isFa ? "تلاش دوباره" : "Try again")
              : provider
                ? (isFa ? "پرداخت و ثبت سفارش" : "Pay and place order")
                : (isFa ? "انتخاب درگاه پرداخت" : "Choose a gateway")}
      </VendoraButton>
    </aside>
  );
}

interface GatewayRedirectProps {
  locale: Locale;
  provider: PaymentProviderId;
}

/** Full-screen handoff state shown briefly after the existing order API succeeds. */
export function GatewayRedirect({ locale, provider }: GatewayRedirectProps) {
  const isFa = locale === "fa";
  const providerName = provider === "zarinpal" ? (isFa ? "زرین‌پال" : "Zarinpal") : (isFa ? "بانک ملی" : "Bank Melli");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/35 p-4" role="status" aria-live="assertive">
      <div className="w-full max-w-[440px] rounded-[20px] border border-vd-line bg-white p-8 text-center shadow-pop">
        <span className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-vd-line">
          <span className={`h-10 w-10 animate-pulse rounded-full ${provider === "zarinpal" ? "bg-[#E0A525]" : "bg-vd-info"}`} />
        </span>
        <CreditCardIcon size={22} className="mx-auto mt-5 text-jade" />
        <h2 className="mt-3 text-xl font-extrabold text-ink">{isFa ? `در حال انتقال به ${providerName}` : `Handoff to ${providerName}`}</h2>
        <p className="mt-3 text-sm leading-7 text-vd-muted">{isFa ? "سفارش ثبت شد. لطفاً این صفحه را تا تکمیل انتقال نبندید." : "Your order was created. Keep this page open while the handoff completes."}</p>
      </div>
    </div>
  );
}

/** Direction-safe label/value row shared by payment totals. */
function SummaryLine({ label, value, muted = false, accent = false }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-vd-muted">{label}</dt>
      <dd className={`m-0 max-w-[62%] text-end font-bold ${muted ? "text-vd-muted" : accent ? "text-vd-warning" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
