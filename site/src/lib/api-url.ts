/** Normalizes either an absolute API origin or the same-origin /api deployment path exactly once. */
export function apiUrl(configured: string, serverOrigin?: string): string {
  if (serverOrigin) return `${serverOrigin.replace(/\/+$/, '').replace(/\/api$/i, '')}/api`;
  const value = configured.trim().replace(/\/+$/, '') || '/api';
  if (value === '/api') return '/api';
  return `${value.replace(/\/api$/i, '')}/api`;
}

/** Keeps uploads on the public storefront origin in proxy deployments, never exposing a private Docker hostname. */
export function apiImageUrl(image: string, publicApi: string): string {
  if (/^https?:\/\//i.test(image)) return image;
  if (publicApi.trim().replace(/\/+$/, '') === '/api') return `/${image.replace(/^\/+/, '')}`;
  return new URL(image, new URL(publicApi).origin).toString();
}
