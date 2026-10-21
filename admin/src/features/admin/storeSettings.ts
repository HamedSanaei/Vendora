import { createContext, useContext } from 'react';
import { httpClient } from '../../lib/api/httpClient';
import type { StoreProfile } from './store-settings-model';
export { brandText, storePresentation } from './store-settings-model';
export type { StoreProfile } from './store-settings-model';

export const StoreSettingsContext = createContext<{ profile: StoreProfile; update: (value: StoreProfile) => void }>({ profile: {}, update: () => undefined });

/** Reads saved presentation settings and the post-save updater. */
export function useAdminStoreSettings() { return useContext(StoreSettingsContext); }

/** Resolves API-owned uploads and legacy public logo URLs for image previews. */
export function storeImageUrl(value: string): string {
  return new URL(value, new URL(httpClient.defaults.baseURL || window.location.origin).origin).toString();
}
