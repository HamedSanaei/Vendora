"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { mockProfile } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { VendoraButton } from "@/components/vendora/ui/button";
import { ResultState } from "@/components/vendora/ui/empty-state";
import { TextareaField, TextField } from "@/components/vendora/ui/form-field";
import {
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  QuickPayIcon,
  WalletIcon,
  WarningIcon,
} from "@/components/vendora/icons";

/**
 * Quick pay form (Penpot "Quick Pay"): payer summary, amount field,
 * gateway/credit method radio-cards, notes and captcha. Submission only
 * routes to the demo result screen — no real payment is triggered.
 */
export function QuickPayForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("online");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const numeric = Number(amount.replace(/[^\d]/g, ""));
    if (!numeric || numeric <= 0) {
      setError(t.account.quickPay.invalidAmount);
      return;
    }
    // Demo only: never hits a payment provider.
    router.push(withLocalePath("/account/quick-pay/result?status=success", locale));
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      {/* Payer summary */}
      <section className="flex items-center gap-4 rounded-card bg-surface-soft p-6">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-tint text-lg font-bold text-jade">
          V
        </span>
        <div>
          <p className="vd-text-caption font-semibold text-vd-muted">{t.account.quickPay.payerTitle}</p>
          <p className="text-base font-bold text-ink">{locale === "fa" ? mockProfile.fullName : mockProfile.fullNameEn}</p>
          <p className="vd-text-caption text-vd-success">{t.account.quickPay.payerMeta}</p>
        </div>
      </section>

      {/* Form card */}
      <section className="rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.account.quickPay.formSection}</h2>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextField
            label={t.account.quickPay.amountLabel}
            inputMode="numeric"
            dir="ltr"
            placeholder={t.account.quickPay.amountPlaceholder}
            hint={t.account.quickPay.amountHint}
            error={error ?? undefined}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
          />
        </div>

        <fieldset aria-label={t.account.quickPay.methodLabel} className="mt-7">
          <legend className="mb-3 text-[0.8125rem] font-semibold leading-7 text-ink">{t.account.quickPay.methodLabel}</legend>
          <div className="grid gap-4 lg:grid-cols-2">
            <label
              className={`vd-focus flex cursor-pointer items-center gap-4 rounded-control border p-4 transition-colors ${
                method === "online" ? "border-jade bg-jade-tint" : "border-vd-line hover:border-vd-muted"
              }`}
            >
              <input
                type="radio"
                name="quick-pay-method"
                value="online"
                checked={method === "online"}
                onChange={() => setMethod("online")}
                className="h-4 w-4 accent-[#006b4f]"
              />
              <CreditCardIcon size={24} className={method === "online" ? "text-jade" : "text-vd-muted"} />
              <span>
                <span className={`block text-sm ${method === "online" ? "font-bold text-jade" : "font-semibold text-ink"}`}>
                  {t.account.quickPay.methodOnline}
                </span>
                <span className="vd-text-caption block text-vd-muted">{t.account.quickPay.methodOnlineHint}</span>
              </span>
            </label>
            <label
              className={`vd-focus flex cursor-pointer items-center gap-4 rounded-control border p-4 transition-colors ${
                method === "credit" ? "border-jade bg-jade-tint" : "border-vd-line hover:border-vd-muted"
              }`}
            >
              <input
                type="radio"
                name="quick-pay-method"
                value="credit"
                checked={method === "credit"}
                onChange={() => setMethod("credit")}
                className="h-4 w-4 accent-[#006b4f]"
              />
              <WalletIcon size={24} className={method === "credit" ? "text-jade" : "text-vd-muted"} />
              <span>
                <span className={`block text-sm ${method === "credit" ? "font-bold text-jade" : "font-semibold text-ink"}`}>
                  {t.account.quickPay.methodCredit}
                </span>
                <span className="vd-text-caption block text-vd-muted">{t.account.quickPay.methodCreditHint}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <TextareaField label={t.account.quickPay.notesLabel} rows={3} placeholder={t.account.quickPay.notesPlaceholder} />
          <div>
            <label htmlFor="vd-pay-captcha" className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
              {t.account.quickPay.captchaLabel}
            </label>
            <div className="grid grid-cols-[132px_minmax(0,1fr)] items-end gap-3">
              <span
                aria-hidden
                className="flex h-[52px] select-none items-center justify-center rounded-control border border-vd-line bg-surface-soft text-base font-bold tracking-[0.35em] text-ink"
                style={{ fontFamily: "monospace" }}
              >
                {localizeDigits("7254", locale)}
              </span>
              <input
                id="vd-pay-captcha"
                inputMode="numeric"
                placeholder={t.account.quickPay.captchaPlaceholder}
                className="h-[52px] w-full rounded-control border border-vd-line bg-white px-4 text-sm text-ink placeholder:text-vd-muted vd-focus"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <VendoraButton type="submit" size="lg" className="min-w-[220px]">
            {t.account.quickPay.pay}
          </VendoraButton>
        </div>
      </section>

      {/* Trust band */}
      <section className="flex items-start gap-4 rounded-card bg-jade-tint p-6">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-white text-jade">
          <QuickPayIcon size={26} />
        </span>
        <div>
          <p className="text-[1.0625rem] font-bold text-ink">{t.account.quickPay.trustTitle}</p>
          <p className="vd-text-body mt-1 max-w-2xl text-vd-muted">{t.account.quickPay.trustBody}</p>
        </div>
      </section>
    </form>
  );
}

/**
 * Payment result screen (Penpot success / failed / pending frames).
 * Reads `?status=` and renders the matching state with a masked tracking code.
 */
export function QuickPayResult({ locale }: { locale: Locale }) {
  const t = getDict(locale).account.quickPay.resultPage;
  const params = useSearchParams();
  const status = params.get("status") ?? "success";

  if (status === "failed") {
    return (
      <ResultState tone="danger" icon={<WarningIcon size={48} />} title={t.failedTitle} body={t.failedBody}>
        <div className="flex justify-center gap-4">
          <VendoraButton href={withLocalePath("/account/quick-pay", locale)} size="lg">
            {t.retry}
          </VendoraButton>
          <VendoraButton href={withLocalePath("/account", locale)} variant="outline" size="lg">
            {t.backHome}
          </VendoraButton>
        </div>
      </ResultState>
    );
  }

  if (status === "pending") {
    return (
      <ResultState tone="warning" icon={<ClockIcon size={48} />} title={t.pendingTitle} body={t.pendingBody}>
        <TrackingCard label={t.trackingLabel} locale={locale} viewLabel={t.viewTransactions} />
      </ResultState>
    );
  }

  return (
    <ResultState tone="success" icon={<CheckIcon size={48} />} title={t.successTitle} body={t.successBody}>
      <TrackingCard label={t.trackingLabel} locale={locale} viewLabel={t.viewTransactions} />
    </ResultState>
  );
}

function TrackingCard({
  label,
  locale,
  viewLabel,
}: {
  label: string;
  locale: Locale;
  viewLabel: string;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-card border border-vd-line bg-white px-6 py-5">
        <p className="vd-text-caption text-vd-muted">{label}</p>
        <p dir="ltr" className="mt-1 text-lg font-bold tracking-wider text-ink rtl:text-right">
          {localizeDigits("VD-PAY-••••••", locale)}
        </p>
      </div>
      <div className="flex justify-center gap-4">
        <VendoraButton href={withLocalePath("/account/transactions", locale)} size="lg">
          {viewLabel}
        </VendoraButton>
        <VendoraButton href={withLocalePath("/account", locale)} variant="outline" size="lg">
          {getDict(locale).common.back}
        </VendoraButton>
      </div>
    </div>
  );
}
