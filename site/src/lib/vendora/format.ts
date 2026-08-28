import type { Locale } from "./types";

/**
 * Locale-aware formatting helpers shared across the storefront UI.
 * Persian output uses Persian digits to match the Penpot design.
 */

const numberFormatters: Record<Locale, Intl.NumberFormat> = {
  fa: new Intl.NumberFormat("fa-IR"),
  en: new Intl.NumberFormat("en-US"),
};

/**
 * Formats a plain number with locale digits and separators.
 * @param value Numeric value.
 * @param locale Active locale.
 */
export function formatNumber(value: number, locale: Locale): string {
  return numberFormatters[locale].format(value);
}

/**
 * Formats a Toman price the way the design shows it (e.g. ۱٬۸۹۰٬۰۰۰ تومان).
 * @param value Price in Toman.
 * @param locale Active locale.
 * @param withUnit Whether to append the currency unit (defaults to true).
 */
export function formatPrice(value: number, locale: Locale, withUnit = true): string {
  const unit = locale === "fa" ? "تومان" : "Toman";
  return `${numberFormatters[locale].format(value)}${withUnit ? ` ${unit}` : ""}`;
}

/**
 * Formats a signed transaction amount (+/−) with locale digits.
 * @param amount Absolute amount in Toman.
 * @param direction Money direction; incoming amounts get the plus sign.
 */
export function formatSignedAmount(amount: number, direction: "in" | "out", locale: Locale): string {
  const sign = direction === "in" ? "+" : "−";
  return `${sign}${numberFormatters[locale].format(amount)}`;
}

/**
 * Converts Latin digits inside a string into Persian digits (fa only).
 * Useful for codes such as VD-1048 shown on Persian pages.
 */
export function localizeDigits(text: string, locale: Locale): string {
  if (locale !== "fa") return text;
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return text.replace(/\d/g, (d) => persianDigits[Number(d)]);
}
