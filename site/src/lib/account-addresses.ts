import axios from "axios";
import { http } from "./http";

/** A WGS84 point selected by the customer; no implicit default delivery location. */
export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

/** Editable account address input shared by the address form and its API hooks. */
export interface AddressInput {
  title: string;
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  streetAddress: string;
  plaque: string | null;
  unit: string | null;
  postalCode: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
}

/** Persisted shipping address returned by the authenticated account API. */
export interface CustomerAddress extends AddressInput {
  id: string;
}

/** The real address text returned by the server-side Neshan reverse lookup. */
export interface ReverseGeocodedAddress {
  formattedAddress: string;
}

/** Expected lookup failures that the form can explain without exposing provider details. */
export type AddressLookupFailure = "notConfigured" | "notFound" | "failed";

/** Resolves a selected point through the authenticated API; signal cancels superseded selections. */
export async function reverseGeocodeAddress(point: MapCoordinates, accessToken: string, signal: AbortSignal): Promise<ReverseGeocodedAddress> {
  const { data } = await http.get<ReverseGeocodedAddress>("/account/addresses/reverse-geocode", {
    params: point,
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  return data;
}

/** Converts stable API error codes to localized form states; upstream error text is never shown. */
export function getAddressLookupFailure(error: unknown): AddressLookupFailure {
  if (axios.isAxiosError<{ code?: string }>(error)) {
    if (error.response?.data?.code === "address_lookup_not_configured") return "notConfigured";
    if (error.response?.data?.code === "address_lookup_not_found") return "notFound";
  }
  return "failed";
}

/** Converts Persian/Arabic digits to ASCII for Iranian phone and postal-code validation. */
export function normalizeAddressDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
