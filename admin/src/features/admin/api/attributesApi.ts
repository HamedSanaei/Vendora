import axios from 'axios';
import { httpClient } from '../../../lib/api/httpClient';
import type { AttributeDefinition, AttributeNameInput, AttributeTerm } from '../types';

/** Reads the reusable registry once per editor/page, including archived assignments. */
export async function getAttributeDefinitions(): Promise<AttributeDefinition[]> {
  return (await httpClient.get<AttributeDefinition[]>('/api/admin/attributes')).data;
}

/** Creates or updates a global attribute without changing its terms or assigned products. */
export async function saveAttributeDefinition(input: AttributeNameInput, id?: string): Promise<AttributeDefinition> {
  const path = '/api/admin/attributes';
  return (id ? await httpClient.put<AttributeDefinition>(`${path}/${id}`, input)
    : await httpClient.post<AttributeDefinition>(path, input)).data;
}

/** Creates/renames/archives a reusable value using the shared authenticated Axios client. */
export async function saveAttributeTerm(attributeId: string, input: AttributeNameInput, id?: string): Promise<AttributeTerm> {
  const path = `/api/admin/attributes/${attributeId}/terms`;
  return (id ? await httpClient.put<AttributeTerm>(`${path}/${id}`, input)
    : await httpClient.post<AttributeTerm>(path, input)).data;
}

/** Localizes registry validation/transport failures without claiming a failed save succeeded. */
export function attributeError(error: unknown, isFa: boolean): string {
  const message = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
  if (!isFa) return message ?? 'Unable to load or save attributes. Please retry.';
  if (message?.includes('already')) return 'نام یا اسلاگ تکراری است؛ مقدار دیگری وارد کنید.';
  if (message?.includes('characters')) return 'نام یا اسلاگ از محدودهٔ مجاز طولانی‌تر است.';
  if (message?.includes('not found')) return 'ویژگی یا مقدار موردنظر پیدا نشد. فهرست را دوباره بارگیری کنید.';
  return 'دریافت یا ذخیرهٔ ویژگی‌ها انجام نشد. اتصال را بررسی و دوباره تلاش کنید.';
}
