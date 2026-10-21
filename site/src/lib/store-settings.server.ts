import 'server-only';
import { cache } from 'react';
import { http } from './http';
import type { StoreProfile } from '@/lib/store-settings';

/** Shares public settings within one server render, keeping the original presentation available during outages. */
export const readStoreSettings = cache(async (): Promise<StoreProfile> => {
  try { return (await http.get<StoreProfile>('/store-settings', { headers: { 'Cache-Control': 'no-cache' } })).data; }
  catch { return {}; }
});
