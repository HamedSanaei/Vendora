import axios from 'axios';
import { resolveAdminApiBaseUrl } from './api-url';

export const apiBaseUrl = resolveAdminApiBaseUrl(import.meta.env.VITE_API_BASE_URL, window.location.origin, import.meta.env.DEV);

/** Shared Axios client for all API calls made by the React app. */
export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

let authToken = localStorage.getItem('vendora_admin_token');

/** Updates the bearer token used by the shared Axios client. */
export function setHttpAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem('vendora_admin_token', token);
  } else {
    localStorage.removeItem('vendora_admin_token');
  }
}

httpClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});
