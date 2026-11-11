"use client";

import { useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { SelectField, TextField } from "@/components/vendora/ui/form-field";
import { iranAddressRegions } from "@/lib/iran-address-regions";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";

type RegionValues = { province: string; city: string };
type RegionField<Name extends keyof RegionValues> = Pick<ControllerRenderProps<RegionValues, Name>, "name" | "value" | "onChange" | "onBlur" | "ref">;

interface AddressRegionFieldsProps {
  locale: Locale;
  province: RegionField<"province">;
  city: RegionField<"city">;
  provinceError?: string;
  cityError?: string;
}

const provinces = Object.keys(iranAddressRegions);
const manualCityOption = "__manual_city__";
const legacyProvinceNames: Readonly<Record<string, string>> = { tehran: "تهران", alborz: "البرز", isfahan: "اصفهان" };

/** Matches saved names with alternate Persian spelling or spacing without changing the saved value. */
function regionKey(value: string): string {
  return value.replaceAll("ي", "ی").replaceAll("ك", "ک").replace(/[\s\u200c]+/g, "").toLowerCase();
}

/** Selects dependent address regions and keeps older or unlisted destinations editable. */
export function AddressRegionFields({ locale, province, city, provinceError, cityError }: AddressRegionFieldsProps) {
  const t = getDict(locale).account.addresses.form;
  const [manualProvince, setManualProvince] = useState<string | null>(null);
  const provinceKey = regionKey(province.value);
  const listedProvince = provinces.find((name) => regionKey(name) === provinceKey || legacyProvinceNames[provinceKey] === name);
  const cities = listedProvince ? iranAddressRegions[listedProvince] : [];
  const cityKey = regionKey(city.value);
  const listedCity = cities.find((name) => regionKey(name) === cityKey);
  const hasProvince = Boolean(province.value);
  const manual = hasProvince && (manualProvince === province.value || Boolean(city.value && !listedCity));

  return (
    <>
      <SelectField {...province} label={t.province} error={provinceError} autoComplete="address-level1"
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === province.value) return;
          province.onChange(value);
          city.onChange("");
          setManualProvince(null);
        }}>
        <option value="">{t.chooseProvince}</option>
        {hasProvince && !listedProvince && <option value={province.value}>{province.value}</option>}
        {provinces.map((name) => <option key={name} value={name === listedProvince ? province.value : name}>{name}</option>)}
      </SelectField>
      <div>
        <SelectField label={t.city} error={manual ? undefined : cityError} disabled={!hasProvince} autoComplete="address-level2"
          name={manual ? undefined : city.name} ref={manual ? undefined : city.ref} onBlur={manual ? undefined : city.onBlur}
          value={manual ? manualCityOption : city.value}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setManualProvince(value === manualCityOption ? province.value : null);
            city.onChange(value === manualCityOption ? "" : value);
          }}>
          <option value="">{hasProvince ? t.chooseCity : t.chooseProvinceFirst}</option>
          {cities.map((name) => <option key={name} value={name === listedCity && !manual ? city.value : name}>{name}</option>)}
          {hasProvince && <option value={manualCityOption}>{t.unlistedCity}</option>}
        </SelectField>
        {manual && <TextField {...city} className="mt-3" label={t.cityOrVillage} maxLength={100} error={cityError}
          onChange={(event) => { setManualProvince(province.value); city.onChange(event.currentTarget.value); }} />}
      </div>
    </>
  );
}
