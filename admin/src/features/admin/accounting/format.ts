import type { AdminLocale } from '../i18n';
/** Formats administrative values without replacing authoritative server decimal calculations. */
export const number = (value: number, locale: AdminLocale) => value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 8 });
/** Formats a persisted UTC document date in the active locale. */
export const date = (value: string, locale: AdminLocale) => new Date(value).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB');

/** Converts only valid URL dates to inclusive UTC filter boundaries. */
export function reportDate(value: string | null, end = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.toISOString() : null;
}
