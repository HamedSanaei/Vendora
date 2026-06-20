export const supportedLocales = ["fa", "en"];

/**
 * Reads the active locale from the current pathname and defaults to Persian.
 * @param {string} pathname Current browser pathname.
 * @returns {"fa" | "en"} Locale extracted from the route.
 */
export function getLocaleFromPathname(pathname = "") {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment === "en" ? "en" : "fa";
}

/**
 * Adds the active locale prefix to internal routes while preserving query/hash.
 * @param {string} href Internal route, query, hash, or external URL.
 * @param {"fa" | "en"} locale Active locale.
 * @returns {string} Locale-prefixed route for internal navigation.
 */
export function withLocalePath(href = "/", locale = "fa") {
  if (!href || href === "#") return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("#")) return href;

  const [pathAndQuery, hash = ""] = href.split("#");
  const [path = "/", query = ""] = pathAndQuery.split("?");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const segments = cleanPath.split("/").filter(Boolean);

  if (supportedLocales.includes(segments[0])) {
    segments.shift();
  }

  const route = segments.length > 0 ? `/${segments.join("/")}` : "";
  const queryPart = query ? `?${query}` : "";
  const hashPart = hash ? `#${hash}` : "";

  return `/${locale}${route}${queryPart}${hashPart}`;
}

/**
 * Builds a shop URL with query parameters for the active locale.
 * @param {"fa" | "en"} locale Active locale.
 * @param {Record<string, string | number | undefined | null>} params Query params.
 * @returns {string} Locale-aware shop URL.
 */
export function buildLocalizedShopPath(locale, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return withLocalePath(`/shop${queryString ? `?${queryString}` : ""}`, locale);
}

/**
 * Converts display text into the simple slug format used by the template mocks.
 * @param {string} value Display value.
 * @returns {string} URL-safe slug fragment.
 */
export function toTemplateSlug(value = "") {
  return String(value ?? "").toLowerCase().replace("&", "").trim().split(/\s+/).join("-");
}
