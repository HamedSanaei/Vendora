import axios from 'axios';
import { httpClient } from '../../../lib/api/httpClient';
import type { SeoAnalysis, SeoDraft, SeoRedirect, SeoSuggestion, SiteSeoSettings } from '../seo/types';

/** Draft analysis uses cancellation and never invokes external inference. */
export async function analyzeSeo(draft: SeoDraft, signal: AbortSignal): Promise<SeoAnalysis> {
  return (await httpClient.post<SeoAnalysis>('/api/admin/seo/analyze', draft, { signal })).data;
}
/** An explicit admin action returns a preview, never a product/category update. */
export async function suggestSeo(operation: string, draft: SeoDraft, signal: AbortSignal): Promise<SeoSuggestion> {
  return (await httpClient.post<SeoSuggestion>('/api/admin/seo/ai/suggest', { operation, draft }, { signal, timeout: 65_000 })).data;
}
export async function getSeoModels(): Promise<{configured: boolean; models: string[]}> {
  return (await httpClient.get<{configured: boolean; models: string[]}>('/api/admin/seo/ai/models')).data;
}
export async function getSeoSettings(): Promise<SiteSeoSettings> { return (await httpClient.get<SiteSeoSettings>('/api/admin/seo/settings')).data; }
export async function saveSeoSettings(value: SiteSeoSettings): Promise<void> { await httpClient.put('/api/admin/seo/settings', value); }
export async function getSeoRedirects(): Promise<SeoRedirect[]> { return (await httpClient.get<SeoRedirect[]>('/api/admin/seo/redirects')).data; }
export async function saveSeoRedirect(value: SeoRedirect): Promise<void> { await httpClient.post('/api/admin/seo/redirects', value); }
/** Keeps safe server validation messages while hiding transport/configuration internals. */
export function seoError(error: unknown): string {
  if (axios.isAxiosError<{message?: string}>(error) && error.response?.data.message) return error.response.data.message;
  return 'ارتباط با سرویس انجام نشد. اطلاعات فرم شما تغییر نکرده است.';
}
