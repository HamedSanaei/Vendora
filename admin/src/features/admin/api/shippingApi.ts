import { httpClient } from '../../../lib/api/httpClient';

export interface ShippingPackage { minQuantity: number; maxQuantity: number; emptyWeightGrams: number; lengthCm: number; widthCm: number; heightCm: number; boxTypeId: number }
export interface ShippingPolicy { id: number; includedInPrice: boolean; unitAmount: number; version: number; originCityCode: string; originLatitude: number | null; originLongitude: number | null; courierCode: string; serviceType: string; paymentType: string; collectionType: string }
export interface ShippingSettings { policy: ShippingPolicy; packages: ShippingPackage[]; postexConfigured: boolean }
export interface ShippingReference { code: string; name: string; province?: string }

/** Loads only non-secret shipping configuration using the shared authenticated transport. */
export async function readShippingSettings(): Promise<ShippingSettings> {
  const { data } = await httpClient.get<ShippingSettings>('/api/admin/store-settings/shipping');
  if (!data.policy || !Array.isArray(data.packages)) throw new Error('Invalid shipping settings response');
  return data;
}

/** Saves an explicit versioned policy; a stale editor receives a conflict instead of overwriting another admin. */
export async function saveShippingSettings(value: ShippingSettings): Promise<ShippingSettings> {
  return (await httpClient.put<ShippingSettings>('/api/admin/store-settings/shipping', { policy: value.policy, packages: value.packages })).data;
}

/** Reads only allowlisted server-mediated carrier reference values; the API key never reaches the browser. */
export async function shippingReferences(resource: 'cities' | 'methods' | 'boxes'): Promise<ShippingReference[]> {
  return (await httpClient.get<{items: ShippingReference[]}>(`/api/shipping/reference/${resource}`)).data.items;
}
