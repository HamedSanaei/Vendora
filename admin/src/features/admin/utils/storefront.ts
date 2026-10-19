import type { AdminLocale } from '../i18n';

/** Builds a localized public product URL using the same storefront origin as the admin navigation. */
export function productStorefrontUrl(locale: AdminLocale, productId: string): string {
  const origin = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${origin}/${locale}/product-details/${encodeURIComponent(productId)}`;
}
