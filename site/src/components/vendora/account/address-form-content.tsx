"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import useAuthCheck from "@/hooks/use-auth-check";
import { useCreateAddressMutation, useGetAddressesQuery, useUpdateAddressMutation } from "@/redux/features/auth/authApi";
import { normalizeAddressDigits, type AddressInput, type CustomerAddress, type MapCoordinates } from "@/lib/account-addresses";
import { getDict } from "@/lib/vendora/i18n";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { notifySuccess } from "@/utils/toast";
import { VendoraButton } from "@/components/vendora/ui/button";
import { Switch } from "@/components/vendora/ui/choice-controls";
import { SelectField, TextField, TextareaField } from "@/components/vendora/ui/form-field";
import { AddressSignInNotice } from "./addresses-content";
import { NeshanLocationPicker } from "./neshan-location-picker";

const emptyAddress: AddressInput = {
  title: "", recipientName: "", phoneNumber: "", province: "", city: "", streetAddress: "",
  plaque: "", unit: "", postalCode: "", isDefault: false, latitude: null, longitude: null,
};

interface AddressFormContentProps {
  locale: Locale;
  addressId?: string;
  mapApiKey: string;
  mapKeyInvalid: boolean;
}

/** Creates or edits a real account address, preserving an explicitly selected Neshan delivery point. */
export function AddressFormContent({ locale, addressId, mapApiKey, mapKeyInvalid }: AddressFormContentProps) {
  const a = getDict(locale).account.addresses;
  const t = a.form;
  const router = useRouter();
  const authChecked = useAuthCheck();
  const user = useSelector((state: { auth: { user?: { name?: string; phone?: string } } }) => state.auth.user);
  const { data, isLoading, isError, refetch } = useGetAddressesQuery(undefined, { skip: !authChecked || !user || !addressId });
  const [createAddress, { isLoading: creating }] = useCreateAddressMutation();
  const [updateAddress, { isLoading: updating }] = useUpdateAddressMutation();
  const [saveError, setSaveError] = useState("");
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<AddressInput>({ defaultValues: emptyAddress });
  const addresses = (data ?? []) as CustomerAddress[];
  const address = addressId ? addresses.find((item) => item.id === addressId) : undefined;
  const [latitude, longitude, isDefault] = useWatch({ control, name: ["latitude", "longitude", "isDefault"] });
  const location = latitude != null && longitude != null ? { latitude, longitude } : null;
  const busy = creating || updating;

  useEffect(() => {
    if (addressId) {
      if (address) reset({ ...address, latitude: address.latitude ?? null, longitude: address.longitude ?? null });
    } else if (user) {
      reset({ ...emptyAddress, recipientName: user.name ?? "", phoneNumber: user.phone ?? "" });
    }
  }, [address, addressId, reset, user]);

  /** Stores both coordinate components together; clearing the pin explicitly sends two nulls. */
  const selectLocation = useCallback((point: MapCoordinates | null) => {
    setValue("latitude", point?.latitude ?? null, { shouldDirty: true });
    setValue("longitude", point?.longitude ?? null, { shouldDirty: true });
  }, [setValue]);

  /** Keeps required text fields nonblank before the server performs authoritative address validation. */
  function required(value: string | null) {
    return Boolean(value?.trim()) || t.requiredError;
  }

  /** Persists the entire address and navigates back only after the authenticated write succeeds. */
  async function save(values: AddressInput) {
    setSaveError("");
    const payload: AddressInput = {
      ...values,
      phoneNumber: normalizeAddressDigits(values.phoneNumber),
      postalCode: normalizeAddressDigits(values.postalCode),
      plaque: normalizeAddressDigits(values.plaque ?? ""),
      unit: normalizeAddressDigits(values.unit ?? ""),
    };
    try {
      if (addressId) await updateAddress({ id: addressId, ...payload }).unwrap();
      else await createAddress(payload).unwrap();
      notifySuccess(t.saved);
      router.push(withLocalePath("/account/addresses", locale));
    } catch {
      setSaveError(t.failed);
    }
  }

  if (!authChecked || (user && addressId && isLoading)) return <p role="status" className="py-8 text-sm text-vd-muted">{a.loading}</p>;
  if (!user) return <AddressSignInNotice locale={locale} returnTo={`/account/addresses/new${addressId ? `?id=${addressId}` : ""}`} />;
  if (addressId && isError) return <div role="alert" className="rounded-card border border-vd-line p-6"><p className="mb-4 text-sm text-vd-danger">{a.loadFailed}</p><VendoraButton type="button" variant="outline" onClick={() => refetch()}>{a.retry}</VendoraButton></div>;
  if (addressId && !address) return <div role="alert" className="rounded-card border border-vd-line p-6"><p className="mb-4 text-sm text-vd-danger">{t.notFound}</p><VendoraButton href={withLocalePath("/account/addresses", locale)} variant="outline">{getDict(locale).common.back}</VendoraButton></div>;

  return (
    <form className="vd-address-form" noValidate onSubmit={handleSubmit(save)}>
      <div className="vd-address-form-card rounded-card border border-vd-line bg-white p-[20px] md:p-8">
        <fieldset disabled={busy} className="min-w-0 border-0 p-0">
          <legend className="mb-5 text-[1.1875rem] font-bold text-ink">{t.sectionRecipient}</legend>
          <div className="grid gap-[20px] md:grid-cols-2">
            <TextField label={t.titleLabel} maxLength={100} {...register("title")} />
            <TextField label={t.recipientName} autoComplete="name" maxLength={200} error={errors.recipientName?.message} {...register("recipientName", { validate: required })} />
            <TextField label={t.phoneNumber} type="tel" inputMode="tel" dir="ltr" autoComplete="tel-national" maxLength={11} error={errors.phoneNumber?.message} {...register("phoneNumber", { validate: (value) => /^09\d{9}$/.test(normalizeAddressDigits(value)) || t.phoneError })} />
          </div>
          <hr className="my-7 border-vd-line" />
          <h2 className="text-[1.1875rem] font-bold text-ink">{t.sectionLocation}</h2>
          <div className="mt-5 grid gap-[20px] md:grid-cols-2">
            <SelectField label={t.country} defaultValue="ir"><option value="ir">{locale === "fa" ? "ایران" : "Iran"}</option></SelectField>
            <TextField label={t.province} autoComplete="address-level1" maxLength={100} error={errors.province?.message} {...register("province", { validate: required })} />
            <TextField label={t.city} autoComplete="address-level2" maxLength={100} error={errors.city?.message} {...register("city", { validate: required })} />
            <TextField label={t.postalCode} inputMode="numeric" dir="ltr" autoComplete="postal-code" maxLength={10} error={errors.postalCode?.message} {...register("postalCode", { validate: (value) => /^\d{10}$/.test(normalizeAddressDigits(value)) || t.postalError })} />
            <TextField label={t.plaque} maxLength={50} {...register("plaque")} />
            <TextField label={t.unit} maxLength={50} {...register("unit")} />
            <TextareaField label={t.addressLine} rows={3} className="md:col-span-2" autoComplete="street-address" maxLength={1000} error={errors.streetAddress?.message} {...register("streetAddress", { validate: required })} />
          </div>
          <NeshanLocationPicker locale={locale} apiKey={mapApiKey} invalidKey={mapKeyInvalid} value={location} onChange={selectLocation} />
          <div className="mt-7 flex flex-col gap-[20px] border-t border-vd-line pt-6 md:flex-row md:items-center md:justify-between">
            <Switch checked={Boolean(isDefault)} onChange={(checked) => setValue("isDefault", checked, { shouldDirty: true })} label={t.defaultSwitch} />
            <div className="flex flex-wrap gap-3">
              <VendoraButton href={withLocalePath("/account/addresses", locale)} variant="outline">{getDict(locale).common.back}</VendoraButton>
              <VendoraButton type="submit" disabled={busy}>{busy ? t.saving : t.submit}</VendoraButton>
            </div>
          </div>
        </fieldset>
        {saveError ? <p role="alert" className="mt-4 text-sm text-vd-danger">{saveError}</p> : null}
      </div>
    </form>
  );
}
