import axios from 'axios';
import { http } from '@/lib/http';
import { withLocalePath } from '@/lib/locale-path';
import type { Locale } from '@/lib/vendora/types';

export interface ProfileCompletion { firstName?: string; lastName?: string; phoneNumberConfirmed: boolean; isComplete: boolean }
export interface CustomerAccount { id: string; fullName: string; email: string; phoneNumber?: string; bio?: string; role: string; completion?: ProfileCompletion }
export interface ProfileValues { firstName: string; lastName: string; email: string; phone: string }

/** Reads the existing session token without exposing it in URLs or logging it. */
export function accountToken(): string | null {
  try { const value = JSON.parse(localStorage.getItem('auth') ?? '{}'); return typeof value.accessToken === 'string' ? value.accessToken : null; } catch { return null; }
}

/** Fetches current server-owned profile/verification facts through the existing shared Axios transport. */
export async function readCustomerAccount(signal?: AbortSignal): Promise<CustomerAccount> {
  return (await http.get<CustomerAccount>('/account/me', { signal, headers: { Authorization: `Bearer ${accountToken()}` } })).data;
}

/** Saves explicit identity fields; changing a phone invalidates its confirmation on the server. */
export async function saveCustomerProfile(values: ProfileValues, bio?: string): Promise<CustomerAccount> {
  return (await http.put<CustomerAccount>('/account/profile', { ...values, fullName: `${values.firstName} ${values.lastName}`, phoneNumber: values.phone, bio },
    { headers: { Authorization: `Bearer ${accountToken()}` } })).data;
}

/** Sends or verifies a saved-phone challenge; the OTP is never returned from the send endpoint. */
export async function confirmCustomerPhone(code?: string): Promise<{ retryAfter: number }> {
  return (await http.post<{ retryAfter: number }>(code === undefined ? '/account/phone/send' : '/account/phone/confirm', code === undefined ? {} : { code },
    { headers: { Authorization: `Bearer ${accountToken()}` }, timeout: 25000 })).data;
}

/** Refreshes existing Redux/localStorage identity fields while preserving the issued Vendora token. */
export function customerSession(account: CustomerAccount) {
  const user = { id: account.id, _id: account.id, name: account.fullName, email: account.email, phone: account.phoneNumber, bio: account.bio, role: account.role, completion: account.completion };
  const session = { accessToken: accountToken(), user };
  localStorage.setItem('auth', JSON.stringify(session));
  return session;
}

/** Accepts only safe locale-local return paths, preventing external redirects and recursive profile loops. */
export function profileReturnTo(value: string | null | undefined, locale: Locale): string {
  const fallback = withLocalePath('/account', locale);
  return value && (value === `/${locale}` || value.startsWith(`/${locale}/`)) && !/[\\?#\u0000-\u0020]/.test(value)
    && !value.includes('//') && !value.startsWith(`/${locale}/account/profile`) ? value : fallback;
}

/** Builds the existing profile route with an encoded, validated destination; carts and checkout drafts remain intact. */
export function completeProfileHref(locale: Locale, returnTo?: string | null) {
  return `${withLocalePath('/account/profile', locale)}?returnTo=${encodeURIComponent(profileReturnTo(returnTo, locale))}`;
}

/** Returns a safe machine code for localized UI feedback, never raw provider or server exceptions. */
export function profileErrorCode(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 401) return 'UNAUTHORIZED';
  return axios.isAxiosError(error) ? String(error.response?.data?.code ?? error.response?.data?.message ?? 'NETWORK_ERROR') : 'NETWORK_ERROR';
}

/** Reads bounded retry timing after throttling/provider failure so the browser does not immediately resend. */
export function profileRetryAfter(error: unknown): number {
  const value = axios.isAxiosError(error) ? Number(error.response?.data?.retryAfter ?? error.response?.headers['retry-after']) : 0;
  return Number.isFinite(value) ? Math.min(1800, Math.max(0, value)) : 0;
}
