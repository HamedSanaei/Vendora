import axios from "axios";
import { apiUrl, apiImageUrl } from './api-url';

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";
const serverOrigin = typeof window === 'undefined'
  ? process.env.API_INTERNAL_BASE_URL || (configuredBaseUrl.trim().startsWith('/') ? 'http://localhost:5020' : undefined)
  : undefined;

/** Shared storefront transport; the environment may specify the API origin or its /api URL. */
export const http = axios.create({
  baseURL: apiUrl(configuredBaseUrl, serverOrigin),
  headers: { Accept: "application/json" },
  timeout: 15000,
});

/** Resolves backend image paths from the API origin, never relative to the /api endpoint prefix. */
export function resolveApiImageUrl(imageUrl: string): string {
  return apiImageUrl(imageUrl, configuredBaseUrl);
}
