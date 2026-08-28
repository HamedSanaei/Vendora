"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthCheck from "@/hooks/use-auth-check";
import { formatPrice } from "@/lib/vendora/format";
import { getShippingDeliveryTime, getShippingMethodTitle } from "@/lib/vendora/shipping";
import { withLocalePath } from "@/lib/locale-path";
import { VendoraButton } from "@/components/vendora/ui/button";
import { TextareaField } from "@/components/vendora/ui/form-field";
import { CheckoutFlowLayout, CheckoutStageHeader, CheckoutStickyAction } from "./checkout-shell";
import {
  CheckoutReviewItem,
  GatewayRedirect,
  PaymentMethodCard,
  PaymentNotice,
  PaymentSummary,
} from "./payment-components";
import { usePaymentCheckout } from "./use-payment-checkout";

/** Penpot-aligned payment step that consumes the existing order API. */
export function PaymentCheckoutPage() {
  const authChecked = useAuthCheck();
  const router = useRouter();
  const checkout = usePaymentCheckout();
  const {
    locale,
    user,
    items,
    shippingInfo,
    shippingAddress,
    shippingMethod,
    shippingCompleted,
    totals,
    provider,
    setProvider,
    notes,
    setNotes,
    phase,
    errorMessage,
    submit,
  } = checkout;
  const isFa = locale === "fa";
  const busy = phase === "submitting" || phase === "redirecting";
  const shippingHref = withLocalePath("/shipping", locale);
  const shopHref = withLocalePath("/shop", locale);

  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      const returnTo = withLocalePath("/checkout", locale);
      router.replace(`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (items.length > 0 && !shippingCompleted) router.replace(shippingHref);
  }, [authChecked, items.length, locale, router, shippingCompleted, shippingHref, user]);

  if (!authChecked || !user || (items.length > 0 && !shippingCompleted)) {
    return (
      <CheckoutFlowLayout locale={locale}>
        <main className="vd-container flex min-h-[520px] items-center justify-center text-sm text-vd-muted" role="status">
          {isFa ? "در حال آماده‌سازی پرداخت…" : "Preparing payment…"}
        </main>
      </CheckoutFlowLayout>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutFlowLayout locale={locale}>
        <main className="vd-container flex min-h-[560px] flex-col items-center justify-center px-4 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-jade-tint text-3xl" aria-hidden>⌁</span>
          <h1 className="mt-6 text-2xl font-extrabold text-ink">{isFa ? "سبد خرید شما خالی است" : "Your cart is empty"}</h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-vd-muted">
            {isFa ? "برای ادامه پرداخت، ابتدا محصولی به سبد خرید اضافه کنید." : "Add a product to your cart before continuing to payment."}
          </p>
          <VendoraButton href={shopHref} className="mt-6 min-w-[180px]">{isFa ? "مشاهده فروشگاه" : "Browse shop"}</VendoraButton>
        </main>
      </CheckoutFlowLayout>
    );
  }

  const addressTitle = shippingAddress
    ? [shippingAddress.province, shippingAddress.city].filter(Boolean).join("، ")
    : (isFa ? "آدرس انتخاب نشده" : "No address selected");
  const addressDescription = shippingAddress
    ? [shippingAddress.streetAddress, shippingAddress.plaque ? `${isFa ? "پلاک" : "No."} ${shippingAddress.plaque}` : "", shippingAddress.unit ? `${isFa ? "واحد" : "Unit"} ${shippingAddress.unit}` : ""].filter(Boolean).join("، ")
    : (isFa ? "برای ادامه، اطلاعات ارسال را تکمیل کنید." : "Complete your shipping details to continue.");
  const shippingTitle = getShippingMethodTitle(shippingMethod, locale);
  const shippingMeta = `${getShippingDeliveryTime(shippingMethod, locale)} · ${shippingMethod.paymentMode === "collect" ? (isFa ? "کرایه هنگام تحویل" : "Pay on delivery") : formatPrice(shippingMethod.cost, locale)}`;

  return (
    <CheckoutFlowLayout locale={locale}>
      <main className="vd-container pb-32 pt-6 md:pt-9 lg:pb-16">
        <CheckoutStageHeader
          locale={locale}
          activeStep="payment"
          eyebrow={isFa ? "مرحله سوم خرید" : "Checkout step 3"}
          title={isFa ? "پرداخت و ثبت سفارش" : "Payment and order review"}
          description={isFa ? "اطلاعات سفارش را مرور کنید و درگاه پرداخت را انتخاب کنید." : "Review your order and choose a payment gateway."}
          backHref={shippingHref}
          backLabel={isFa ? "بازگشت به اطلاعات ارسال" : "Back to shipping"}
        />

        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="min-w-0 space-y-7">
            <section className="rounded-[20px] border border-vd-line bg-white p-4 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-ink">{isFa ? "مرور اطلاعات ارسال" : "Review shipping information"}</h2>
                  <p className="mt-1 text-xs leading-6 text-vd-muted">{isFa ? "پیش از پرداخت، آدرس و روش ارسال را بررسی کنید." : "Check the address and delivery method before payment."}</p>
                </div>
                <Link href={shippingHref} className="vd-focus inline-flex min-h-11 items-center rounded-sm text-xs font-extrabold text-jade hover:underline">
                  {isFa ? "ویرایش اطلاعات ارسال" : "Edit shipping details"}
                </Link>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <CheckoutReviewItem
                  type="address"
                  locale={locale}
                  title={addressTitle}
                  description={addressDescription}
                  meta={shippingAddress ? `${shippingAddress.recipientName} · ${shippingAddress.phoneNumber}` : undefined}
                  editHref={shippingHref}
                  warning={!shippingAddress}
                />
                <CheckoutReviewItem
                  type="shipping"
                  locale={locale}
                  title={shippingTitle}
                  description={shippingMethod.paymentMode === "collect" ? (isFa ? "کرایه توسط باربری محاسبه و هنگام تحویل دریافت می‌شود." : "The carrier calculates and collects the shipping fee on delivery.") : (isFa ? "هزینه ارسال در مبلغ آنلاین سفارش محاسبه شده است." : "Shipping is included in the online payable amount.")}
                  meta={shippingMeta}
                  editHref={shippingHref}
                />
              </div>
            </section>

            <PaymentNotice locale={locale} state="warning" />

            <section className="rounded-[20px] border border-vd-line bg-white p-4 md:p-6">
              <h2 className="text-lg font-extrabold text-ink">{isFa ? "انتخاب درگاه پرداخت" : "Choose a payment gateway"}</h2>
              <p className="mt-1 text-xs leading-6 text-vd-muted">{isFa ? "پس از ثبت سفارش، وضعیت انتقال به درگاه نمایش داده می‌شود." : "A gateway handoff state appears after the order is created."}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(["zarinpal", "bankMelli"] as const).map((paymentProvider) => (
                  <PaymentMethodCard
                    key={paymentProvider}
                    provider={paymentProvider}
                    locale={locale}
                    selected={provider === paymentProvider}
                    onSelect={() => setProvider(paymentProvider)}
                    state={busy ? "disabled" : phase === "error" && provider === paymentProvider ? "error" : provider === paymentProvider ? "selected" : "default"}
                    size="regular"
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[20px] border border-vd-line bg-white p-4 md:p-6">
              <TextareaField
                label={isFa ? "توضیحات سفارش" : "Order notes"}
                hint={isFa ? "این توضیحات همراه اطلاعات پرداخت تا پایان جریان در مرورگر شما حفظ می‌شود." : "These notes remain in your browser throughout checkout."}
                placeholder={isFa ? "اگر نکته‌ای برای آماده‌سازی سفارش دارید بنویسید…" : "Add any preparation notes…"}
                rows={4}
                maxLength={500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={busy}
              />
              <p className="mt-2 text-end text-[11px] text-vd-muted">{notes.length}/500</p>
            </section>

            {phase === "error" ? (
              <PaymentNotice locale={locale} state="error">
                <span>{errorMessage}</span>
                <button type="button" onClick={() => void submit()} className="vd-focus mt-2 block min-h-11 rounded-sm font-extrabold underline">
                  {isFa ? "تلاش دوباره" : "Try again"}
                </button>
              </PaymentNotice>
            ) : null}
          </div>

          <div className="min-w-0">
            <PaymentSummary
              locale={locale}
              totals={totals}
              shippingMethodTitle={shippingTitle}
              provider={provider}
              phase={phase}
              onSubmit={() => void submit()}
              className="hidden lg:sticky lg:top-5 lg:block"
            />
            <PaymentSummary
              locale={locale}
              totals={totals}
              shippingMethodTitle={shippingTitle}
              provider={provider}
              phase={phase}
              onSubmit={() => void submit()}
              className="lg:hidden"
            />
          </div>
        </div>
      </main>

      <CheckoutStickyAction
        label={isFa ? "مبلغ قابل پرداخت" : "Payable now"}
        value={formatPrice(totals.payable, locale)}
        action={(
          <VendoraButton type="button" size="lg" className="min-w-[166px]" disabled={busy || !provider} onClick={() => void submit()}>
            {phase === "submitting" ? (isFa ? "در حال ثبت…" : "Submitting…") : phase === "redirecting" ? (isFa ? "در حال انتقال…" : "Redirecting…") : phase === "error" ? (isFa ? "تلاش دوباره" : "Try again") : (isFa ? "پرداخت و ثبت" : "Pay and place order")}
          </VendoraButton>
        )}
      />

      {phase === "redirecting" ? <GatewayRedirect locale={locale} provider={provider} /> : null}
    </CheckoutFlowLayout>
  );
}
