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

/** Converts Persian/Arabic digits to ASCII for Iranian phone and postal-code validation. */
export function normalizeAddressDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
