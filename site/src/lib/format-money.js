export function formatToman(value, locale = "fa") {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);

  return locale === "fa" ? `${formatted} تومان` : `${formatted} Toman`;
}
