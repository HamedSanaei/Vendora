"use client";

import { useState } from "react";
import Link from "next/link";
import { mockAddresses } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { StatusBadge } from "@/components/vendora/ui/status-badge";
import { VendoraButton } from "@/components/vendora/ui/button";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import {
  Switch,
} from "@/components/vendora/ui/choice-controls";
import { SelectField, TextField, TextareaField } from "@/components/vendora/ui/form-field";
import { PinIcon } from "@/components/vendora/icons";

/**
 * Address book grid (Penpot "Address List"): address cards with default
 * badge, edit link and a demo remove action, plus the soft tip panel.
 */
export function AddressBookContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [addresses, setAddresses] = useState(mockAddresses);

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<PinIcon size={44} />}
        title={t.account.addresses.emptyTitle}
        body={t.account.addresses.emptyBody}
        action={
          <VendoraButton href={withLocalePath("/account/addresses/new", locale)}>
            {t.account.addresses.add}
          </VendoraButton>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
      <aside className="order-2 rounded-card bg-surface-soft p-6 xl:order-1">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center text-jade">
          <PinIcon size={30} />
        </span>
        <p className="mt-2 text-[1.0625rem] font-bold leading-7 text-ink">{t.account.addresses.tipTitle}</p>
        <p className="vd-text-caption mt-3 text-vd-muted">{t.account.addresses.tipBody}</p>
        <Link
          href={withLocalePath("/policy", locale)}
          className="vd-focus mt-4 inline-flex rounded-control text-[0.8125rem] font-bold text-jade hover:text-jade-dark"
        >
          {t.account.addresses.tipLink} ←
        </Link>
      </aside>

      <div className="order-1 space-y-5 xl:order-2">
        {addresses.map((address) => (
          <article key={address.id} className="rounded-card border border-vd-line bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">{address.title}</h3>
              {address.isDefault ? (
                <StatusBadge tone="success">{t.account.addresses.defaultBadge}</StatusBadge>
              ) : null}
            </div>
            <p className="mt-3 max-w-xl text-sm leading-7 text-ink">{address.address}</p>
            <p className="vd-text-caption mt-2 text-vd-muted">
              {t.account.addresses.recipientPrefix} {address.recipient} ·{" "}
              <span dir="ltr">{localizeDigits(address.phoneMasked, locale)}</span>
            </p>
            <div className="mt-5 flex items-center gap-5">
              <VendoraButton
                href={withLocalePath(`/account/addresses/new?id=${address.id}`, locale)}
                variant="outline"
                size="lg"
                className="min-w-[150px]"
              >
                {t.common.edit}
              </VendoraButton>
              <button
                type="button"
                onClick={() => setAddresses((list) => list.filter((a) => a.id !== address.id))}
                aria-label={`${t.common.delete}: ${address.title}`}
                className="vd-focus rounded-control px-2 py-1.5 text-[0.8125rem] font-semibold text-vd-danger hover:bg-vd-danger-tint"
              >
                {t.common.delete}
              </button>
            </div>
          </article>
        ))}
        <p role="status" aria-live="polite" className="vd-sr-only">
          {t.account.addresses.removed}
        </p>
      </div>
    </div>
  );
}

const iranProvincesFa = ["تهران", "اصفهان", "فارس", "خراسان رضوی", "آذربایجان شرقی"];
const iranProvincesEn = ["Tehran", "Isfahan", "Fars", "Khorasan Razavi", "East Azerbaijan"];

/**
 * Add / edit address form (Penpot "Add Edit Address") with recipient and
 * location sections, decorative map picker, default switch and demo submit.
 */
export function AddressFormContent({ locale }: { locale: Locale }) {
  const t = getDict(locale).account.addresses.form;
  const [isDefault, setIsDefault] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="vd-address-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
      <div className="vd-address-form-card rounded-card border border-vd-line bg-white p-6 md:p-8">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.sectionRecipient}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextField label={getDict(locale).account.profile.firstName} autoComplete="given-name" />
          <TextField label={getDict(locale).account.profile.lastName} autoComplete="family-name" />
          <TextField label={t.company} autoComplete="organization" />
        </div>

        <hr className="my-7 border-vd-line" />

        <h2 className="text-[1.1875rem] font-bold text-ink">{t.sectionLocation}</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SelectField label={t.country} defaultValue={locale === "fa" ? "ir" : "ir"}>
            <option value="ir">{locale === "fa" ? "ایران" : "Iran"}</option>
          </SelectField>
          <SelectField label={t.province} defaultValue="">
            <option value="" disabled>
              {locale === "fa" ? "انتخاب کنید" : "Select"}
            </option>
            {(locale === "fa" ? iranProvincesFa : iranProvincesEn).map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </SelectField>
          <TextField label={t.city} autoComplete="address-level2" />
          <TextField label={t.postalCode} inputMode="numeric" dir="ltr" autoComplete="postal-code" />
          <TextareaField
            label={t.addressLine}
            rows={2}
            className="lg:col-span-2"
            autoComplete="street-address"
          />
        </div>

        {/* Map picker placeholder (no map SDK in this task) */}
        <div className="mt-6 flex min-h-[154px] flex-col items-start justify-center gap-3 rounded-control bg-tile-steel p-6 sm:flex-row sm:items-center sm:justify-between">
          <span aria-hidden className="hidden h-16 w-16 items-center justify-center text-jade sm:flex">
            <PinIcon size={34} />
          </span>
          <div className="text-start">
            <p className="text-[1.0625rem] font-bold text-ink">{t.mapTitle}</p>
            <p className="vd-text-caption mt-1 text-vd-muted">{t.mapBody}</p>
          </div>
          <VendoraButton variant="outline" size="lg" type="button" className="shrink-0">
            {t.mapCta}
          </VendoraButton>
        </div>

        <div className="mt-7 flex flex-col gap-6 border-t border-vd-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <Switch checked={isDefault} onChange={setIsDefault} label={t.defaultSwitch} />
          <div className="flex flex-wrap items-center gap-4">
            <VendoraButton href={withLocalePath("/account/addresses", locale)} variant="outline">
              {getDict(locale).common.back}
            </VendoraButton>
            <VendoraButton type="submit">{t.submit}</VendoraButton>
          </div>
        </div>
        <p role="status" aria-live="polite" className={`vd-text-caption mt-4 text-vd-success ${saved ? "" : "hidden"}`}>
          {t.saved}
        </p>
      </div>
    </form>
  );
}
