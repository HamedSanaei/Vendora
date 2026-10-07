"use client";

import { useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import useAuthCheck from "@/hooks/use-auth-check";
import { useDeleteAddressMutation, useGetAddressesQuery, useSetDefaultAddressMutation } from "@/redux/features/auth/authApi";
import type { CustomerAddress } from "@/lib/account-addresses";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { StatusBadge } from "@/components/vendora/ui/status-badge";
import { VendoraButton } from "@/components/vendora/ui/button";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { PinIcon } from "@/components/vendora/icons";

/** Address book backed by the current customer's API records, including saved delivery locations. */
export function AddressBookContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const a = t.account.addresses;
  const authChecked = useAuthCheck();
  const user = useSelector((state: { auth: { user: unknown } }) => state.auth.user);
  const { data, isLoading, isError, refetch } = useGetAddressesQuery(undefined, { skip: !authChecked || !user });
  const [removeAddress, { isLoading: removing }] = useDeleteAddressMutation();
  const [setDefault, { isLoading: settingDefault }] = useSetDefaultAddressMutation();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const addresses = (data ?? []) as CustomerAddress[];
  const busy = removing || settingDefault;

  /** Deletes only after confirmation and reports success only after the server accepts the mutation. */
  async function remove(address: CustomerAddress) {
    if (!window.confirm(a.deleteConfirm)) return;
    setError("");
    setStatus("");
    try {
      await removeAddress(address.id).unwrap();
      setStatus(a.removed);
    } catch {
      setError(a.actionFailed);
    }
  }

  /** Persists the default address through the existing ownership-protected endpoint. */
  async function makeDefault(id: string) {
    setError("");
    setStatus("");
    try {
      await setDefault(id).unwrap();
      setStatus(a.defaultSaved);
    } catch {
      setError(a.actionFailed);
    }
  }

  if (!authChecked || (user && isLoading)) return <p role="status" className="py-8 text-sm text-vd-muted">{a.loading}</p>;
  if (!user) return <AddressSignInNotice locale={locale} />;
  if (isError) return <div role="alert" className="rounded-card border border-vd-line p-6"><p className="mb-4 text-sm text-vd-danger">{a.loadFailed}</p><VendoraButton type="button" variant="outline" onClick={() => refetch()}>{a.retry}</VendoraButton></div>;
  if (addresses.length === 0) return <EmptyState icon={<PinIcon size={44} />} title={a.emptyTitle} body={a.emptyBody} action={<VendoraButton href={withLocalePath("/account/addresses/new", locale)}>{a.add}</VendoraButton>} />;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <aside className="order-2! rounded-card bg-surface-soft p-6 xl:order-1!">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center text-jade"><PinIcon size={30} /></span>
        <p className="mt-2 text-[1.0625rem] font-bold leading-7 text-ink">{a.tipTitle}</p>
        <p className="vd-text-caption mt-3 text-vd-muted">{a.tipBody}</p>
        <Link href={withLocalePath("/policy", locale)} className="vd-focus mt-4 inline-flex rounded-control text-[0.8125rem] font-bold text-jade hover:text-jade-dark">{a.tipLink}<span aria-hidden className="ms-2">{locale === "fa" ? "←" : "→"}</span></Link>
      </aside>
      <div className="order-1! min-w-0 space-y-5 xl:order-2!">
        {addresses.map((address) => (
          <article key={address.id} className="rounded-card border border-vd-line bg-white p-[20px] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">{address.title}</h3>
              {address.isDefault ? <StatusBadge tone="success">{a.defaultBadge}</StatusBadge> : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-ink">{[address.province, address.city, address.streetAddress].filter(Boolean).join(locale === "fa" ? "، " : ", ")}</p>
            <p className="vd-text-caption mt-2 text-vd-muted">{a.recipientPrefix} {address.recipientName} · <span dir="ltr">{localizeDigits(address.phoneNumber, locale)}</span></p>
            <p className="vd-text-caption mt-2 text-vd-muted">{a.form.postalCode}: <span dir="ltr">{localizeDigits(address.postalCode, locale)}</span></p>
            {address.latitude != null && address.longitude != null ? <p className="vd-text-caption mt-3 flex items-center gap-2 font-semibold text-jade"><PinIcon size={16} />{a.locationSaved}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <VendoraButton href={withLocalePath(`/account/addresses/new?id=${address.id}`, locale)} variant="outline">{t.common.edit}</VendoraButton>
              {!address.isDefault ? <VendoraButton type="button" variant="ghost" disabled={busy} onClick={() => makeDefault(address.id)}>{a.makeDefault}</VendoraButton> : null}
              <VendoraButton type="button" variant="danger-ghost" disabled={busy} onClick={() => remove(address)} aria-label={`${t.common.delete}: ${address.title}`}>{t.common.delete}</VendoraButton>
            </div>
          </article>
        ))}
        <VendoraButton href={withLocalePath("/account/addresses/new", locale)} className="w-full lg:hidden">{a.add}</VendoraButton>
        {error ? <p role="alert" className="text-sm text-vd-danger">{error}</p> : null}
        <p role="status" aria-live="polite" className="vd-text-caption text-jade">{status}</p>
      </div>
    </div>
  );
}

/** Keeps unauthenticated visitors out of address mutations without displaying demo customer data. */
export function AddressSignInNotice({ locale, returnTo = "/account/addresses" }: { locale: Locale; returnTo?: string }) {
  const t = getDict(locale).account.addresses;
  const destination = encodeURIComponent(withLocalePath(returnTo, locale));
  return <EmptyState icon={<PinIcon size={44} />} title={t.signInTitle} body={t.signInBody} action={<VendoraButton href={`${withLocalePath("/login", locale)}?returnTo=${destination}`}>{t.signIn}</VendoraButton>} />;
}
