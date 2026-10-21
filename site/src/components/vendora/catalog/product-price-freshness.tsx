"use client";

import { useCallback, useSyncExternalStore } from "react";
import { formatPriceUpdateDate } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";
import { getCatalogCopy } from "./catalog-copy";
import type { CatalogProductModel } from "./catalog-types";

interface ProductPriceFreshnessProps {
  product: CatalogProductModel;
  locale: Locale;
}

/** Shows today's server-confirmed pricing date and removes expired confirmations locally, without any polling requests. */
export function ProductPriceFreshness({ product, locale }: ProductPriceFreshnessProps) {
  const expiresAt = Date.parse(product.priceFreshness?.expiresAtUtc ?? "");
  const verifiedAt = product.priceFreshness?.verifiedAtUtc ?? "";
  const readFresh = useCallback(() => Number.isFinite(expiresAt) && Date.now() < expiresAt, [expiresAt]);
  const subscribe = useCallback((notify: () => void) => {
    if (!Number.isFinite(expiresAt)) return () => {};
    const timeout = window.setTimeout(notify, Math.max(0, expiresAt - Date.now()));
    // Background-tab timer throttling must not leave an expired "today" label visible on return.
    window.addEventListener("focus", notify);
    document.addEventListener("visibilitychange", notify);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", notify);
      document.removeEventListener("visibilitychange", notify);
    };
  }, [expiresAt]);
  const fresh = useSyncExternalStore(subscribe, readFresh, () => false);
  const date = formatPriceUpdateDate(verifiedAt, locale);
  if (!fresh || product.stock <= 0 || !date) return null;

  return <div className="vd-product-price-freshness flex flex-wrap items-baseline gap-x-1 text-[11px] font-medium leading-5 text-vd-muted">
    <span>{getCatalogCopy(locale).priceLastUpdated}:</span>
    <time dateTime={verifiedAt} className="whitespace-nowrap font-semibold text-jade">{date}</time>
  </div>;
}
