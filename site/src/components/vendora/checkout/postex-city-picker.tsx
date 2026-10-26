"use client";
import { useEffect, useState } from "react";
import { requestPostexCities, type ShippingCity } from "@/lib/shipping-client";
import type { Locale } from "@/lib/vendora/types";

/** Resolves an ambiguous existing address from the real carrier catalog, without exposing the carrier key. */
export function PostexCityPicker({ token, locale, value, onChange }: { token: string; locale: Locale; value: string; onChange: (value: string) => void }) {
  const [cities, setCities] = useState<ShippingCity[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    requestPostexCities(token, controller.signal)
      .then(items => { if (!controller.signal.aborted) { setCities(items); setFailed(false); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [token]);
  return <label className="grid gap-2 text-sm font-bold">{locale === "fa" ? "شهر مقصد در پستِکس" : "Carrier destination city"}
    <select className="min-h-11 max-w-full rounded-control border border-vd-line bg-white p-3" value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{locale === "fa" ? "شهر مطابق آدرس را انتخاب کنید" : "Choose the city matching your address"}</option>
      {cities.map(city => <option key={city.code} value={city.code}>{city.province} ـ {city.name}</option>)}
    </select>
    {failed && <span role="alert">{locale === "fa" ? "دریافت شهرها انجام نشد؛ روش دیگری انتخاب کنید." : "Cities unavailable. Choose another delivery method."}</span>}
  </label>;
}
