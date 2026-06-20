import dayjs from 'dayjs';
import type { AdminLocale } from '../i18n';

/** Formats Toman values for admin tables and dashboard cards. */
export function formatMoney(value: number, locale: AdminLocale = 'fa'): string {
  const formatted = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);

  return locale === 'fa' ? `${formatted} تومان` : `${formatted} Toman`;
}

/** Converts Persian and Arabic-Indic digits to ASCII digits. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/** Keeps only normalized ASCII digits from user-entered numeric text. */
export function getAsciiDigits(value: string): string {
  return normalizeDigits(value).replace(/[^\d]/g, '');
}

/** Formats a numeric input value with thousand separators. */
export function formatNumberInput(value: string, locale: AdminLocale = 'fa'): string {
  const digits = getAsciiDigits(value);
  if (!digits) {
    return '';
  }

  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(Number(digits));
}

/** Parses a formatted numeric input into a number. */
export function parseNumberInput(value: string): number {
  const normalized = getAsciiDigits(value);

  return normalized ? Number(normalized) : 0;
}

/** Formats UTC timestamps into compact admin-facing dates. */
export function formatDate(value: string, locale: AdminLocale = 'fa'): string {
  return locale === 'fa' ? dayjs(value).format('YYYY/MM/DD') : dayjs(value).format('MMM D, YYYY');
}
