import { httpClient } from '../../lib/api/httpClient';

export interface SeedDisplayState { showSeedData: boolean }

/** Reads the persisted store-wide presentation policy using the existing authenticated HTTP client. */
export async function readSeedDisplay(signal?: AbortSignal): Promise<SeedDisplayState> {
  return (await httpClient.get<SeedDisplayState>('/api/store-settings/seed-visibility', { signal })).data;
}

/** Sets an explicit target state; it never deletes or re-seeds records. */
export async function saveSeedDisplay(showSeedData: boolean): Promise<SeedDisplayState> {
  return (await httpClient.put<SeedDisplayState>('/api/admin/store-settings/seed-visibility', { showSeedData })).data;
}
