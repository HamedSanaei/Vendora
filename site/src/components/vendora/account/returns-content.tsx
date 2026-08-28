"use client";

import { useState } from "react";
import Link from "next/link";
import { mockReturns, returnNewDefaults } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale, ReturnStatus } from "@/lib/vendora/types";
import { localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { ReturnStatusBadge, StatusBadge } from "@/components/vendora/ui/status-badge";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { VendoraButton } from "@/components/vendora/ui/button";
import { RadioOption } from "@/components/vendora/ui/choice-controls";
import { TextField } from "@/components/vendora/ui/form-field";
import { ReturnIcon, SearchIcon, UploadIcon } from "@/components/vendora/icons";

type ReturnTab = "all" | ReturnStatus;

/**
 * Returns list (Penpot "Return List"): tabs + search row, request cards and
 * the info guide band.
 */
export function ReturnsListContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [tab, setTab] = useState<ReturnTab>("all");
  const [query, setQuery] = useState("");

  const filtered = mockReturns
    .filter((request) => (tab === "all" ? true : request.status === tab))
    .filter((request) => (query.trim() ? `${request.code} ${request.orderCode}`.toLowerCase().includes(query.trim().toLowerCase()) : true));

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-card bg-surface-soft p-5">
        <div role="group" aria-label={t.account.returns.title} className="flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] font-semibold">
          {(Object.keys(t.account.returns.tabs) as (keyof typeof t.account.returns.tabs)[]).map((key) => {
            const value = key as ReturnTab;
            const active = tab === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={active}
                className={`vd-focus rounded-control pb-1 transition-colors ${
                  active ? "border-b-2 border-jade text-jade" : "text-vd-muted hover:text-ink"
                }`}
              >
                {t.account.returns.tabs[key]}
              </button>
            );
          })}
        </div>
        <label className="flex h-12 items-center gap-2 rounded-control border border-vd-line bg-white px-4">
          <span className="vd-sr-only">{t.account.returns.searchLabel}</span>
          <SearchIcon size={18} className="shrink-0 text-vd-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.account.returns.searchPlaceholder}
            dir="ltr"
            className="h-full w-full bg-transparent text-start text-[0.8125rem] text-ink outline-none placeholder:text-vd-muted rtl:text-right"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ReturnIcon size={44} />} title={t.account.returns.emptyFiltered} body="" />
      ) : (
        <ul className="space-y-5">
          {filtered.map((request) => (
            <li key={request.id}>
              <article className="rounded-card border border-vd-line bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink">
                    {locale === "fa" ? "درخواست مرجوعی" : "Return request"}{" "}
                    {localizeDigits(request.code, locale)}
                  </h3>
                  <ReturnStatusBadge status={request.status} labels={t.account.returns.statusLabels} />
                </div>
                <dl className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="vd-text-caption text-vd-muted">{t.account.returns.idLabel}</dt>
                    <dd className="text-sm font-semibold text-ink">{localizeDigits(request.orderCode, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="vd-text-caption text-vd-muted">{t.account.returns.itemLabel}</dt>
                    <dd className="text-sm font-semibold text-ink">
                      {locale === "fa" ? request.item : request.itemEn}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="vd-text-caption text-vd-muted">{t.account.returns.reasonLabel}</dt>
                    <dd className="text-sm font-semibold text-ink">
                      {locale === "fa" ? request.reason : request.reasonEn}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="vd-text-caption text-vd-muted">{t.account.returns.dateLabel}</dt>
                    <dd className="text-sm font-semibold text-ink">
                      {locale === "fa" ? request.submittedLabel : request.submittedLabelEn}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <VendoraButton href={withLocalePath("/account/returns", locale)} variant="outline" size="lg">
                    {t.account.returns.viewRequest}
                  </VendoraButton>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* Guide */}
      <section className="rounded-card bg-vd-info-tint p-6">
        <h2 className="text-lg font-bold text-vd-info">{t.account.returns.guideTitle}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink">{t.account.returns.guideBody}</p>
        <div className="mt-5">
          <VendoraButton href={withLocalePath("/policy", locale)} variant="outline" size="lg" className="bg-white!">
            {t.account.returns.guideCta}
          </VendoraButton>
        </div>
      </section>
    </div>
  );
}

/**
 * New return request form (Penpot "Return Request"): three-step stepper,
 * contact / order / reason sections, evidence upload zone with captcha and
 * a client-side success state (no server mutation in this task).
 */
export function ReturnNewForm({ locale }: { locale: Locale }) {
  const t = getDict(locale).account.returns.new;
  const root = getDict(locale);
  const [reason, setReason] = useState("2");
  const [opened, setOpened] = useState("no");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-panel border border-vd-line bg-white p-8">
        <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-vd-success-tint text-vd-success">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink">{t.successTitle}</h2>
          <p className="vd-text-body mt-2 text-vd-muted">{t.successBody}</p>
          <VendoraButton href={withLocalePath("/account/returns", locale)} className="mt-7">
            {t.successCta}
          </VendoraButton>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="vd-return-form space-y-6"
    >
      {/* Stepper */}
      <ol className="flex items-center justify-center gap-0 rounded-card bg-surface-soft px-6 py-5">
        {t.stepper.map((step, index) => (
          <li key={step} className="relative flex min-w-[110px] flex-col items-center text-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={`absolute top-[25px] end-[calc(50%+26px)] h-[3px] w-[calc(100%-52px)] rounded-sm ${
                  index <= 1 ? "bg-jade" : "bg-vd-line"
                }`}
              />
            ) : null}
            <span
              className={`z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 text-sm font-bold ${
                index <= 1 ? "border-jade bg-jade text-white" : "border-vd-line bg-white text-vd-muted"
              }`}
            >
              {localizeDigits(String(index + 1), locale)}
            </span>
            <span className={`mt-2 whitespace-nowrap text-[0.6875rem] font-semibold ${index <= 1 ? "text-jade" : "text-vd-muted"}`}>
              {step}
            </span>
          </li>
        ))}
      </ol>

      {/* Contact */}
      <section className="rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.contactSection}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextField label={root.account.profile.firstName} autoComplete="given-name" />
          <TextField label={root.account.profile.lastName} autoComplete="family-name" />
          <TextField label={root.account.profile.email} type="email" dir="ltr" autoComplete="email" />
          <TextField label={root.account.profile.phone} type="tel" dir="ltr" autoComplete="tel" />
        </div>
      </section>

      {/* Order info */}
      <section className="rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.orderSection}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ReadonlyField label={t.orderCodeLabel} value={localizeDigits(returnNewDefaults.orderCode, locale)} />
          <ReadonlyField
            label={t.orderDateLabel}
            value={localizeDigits(locale === "fa" ? returnNewDefaults.orderDateLabel : returnNewDefaults.orderDateLabelEn, locale)}
          />
          <ReadonlyField label={t.productLabel} value={returnNewDefaults.productName} />
          <ReadonlyField label={t.skuLabel} value={returnNewDefaults.sku} />
          <ReadonlyField label={t.quantityLabel} value={localizeDigits(returnNewDefaults.quantity, locale)} />
        </div>
      </section>

      {/* Reason */}
      <section className="rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.reasonSection}</h2>
        <fieldset className="mt-5 grid gap-3 sm:grid-cols-2" aria-label={t.reasonSection}>
          <legend className="vd-sr-only">{t.reasonSection}</legend>
          {t.reasons.map((reasonLabel, index) => (
            <RadioOption
              key={reasonLabel}
              name="return-reason"
              value={String(index)}
              checked={reason === String(index)}
              onChange={setReason}
              label={reasonLabel}
            />
          ))}
        </fieldset>

        <p className="mt-6 text-sm font-semibold text-ink">{t.openedQuestion}</p>
        <div className="mt-2 flex gap-3">
          {[t.yes, t.no].map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setOpened(index === 0 ? "yes" : "no")}
              aria-pressed={opened === (index === 0 ? "yes" : "no")}
              className={`vd-focus rounded-control px-5 py-2.5 text-sm transition-colors ${
                opened === (index === 0 ? "yes" : "no")
                  ? "bg-jade text-white"
                  : "border border-vd-line bg-white text-ink hover:border-jade"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <label htmlFor="vd-return-notes" className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
            {t.extraNotes}
          </label>
          <textarea
            id="vd-return-notes"
            rows={4}
            className="w-full rounded-control border border-vd-line bg-white px-4 py-3 text-sm text-ink placeholder:text-vd-muted vd-focus"
          />
        </div>
      </section>

      {/* Evidence */}
      <section className="rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.evidenceSection}</h2>
        <button
          type="button"
          className="vd-focus mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-vd-line bg-surface-soft px-6 py-10 text-center hover:border-jade"
        >
          <UploadIcon size={28} className="text-jade" />
          <span className="text-sm font-semibold text-ink">{t.uploadTitle}</span>
          <span className="vd-text-caption text-vd-muted">{t.uploadHint}</span>
        </button>

        <div className="mt-6 grid items-end gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="vd-captcha" className="mb-2 block text-[0.8125rem] font-semibold leading-7 text-ink">
              {t.captchaLabel}
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
                id="vd-captcha"
                inputMode="numeric"
                placeholder={t.captchaPlaceholder}
                className="h-[52px] w-full rounded-control border border-vd-line bg-white px-4 text-sm text-ink placeholder:text-vd-muted vd-focus"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-4 lg:justify-end">
            <VendoraButton href={withLocalePath("/account/returns", locale)} variant="outline">
              {root.common.cancel}
            </VendoraButton>
            <VendoraButton type="submit">{t.submit}</VendoraButton>
          </div>
        </div>
        <p className="vd-text-caption mt-5 text-vd-muted">{t.privacyNote}</p>
      </section>
    </form>
  );
}

/** Read-only key/value field used for prefetched order info. */
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-[0.8125rem] font-semibold leading-7 text-ink">{label}</p>
      <p className="flex h-[52px] items-center rounded-control border border-vd-line bg-surface-soft px-4 text-sm text-ink">
        {value}
      </p>
    </div>
  );
}
