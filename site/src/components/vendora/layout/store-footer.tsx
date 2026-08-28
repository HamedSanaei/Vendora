"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";

/**
 * Storefront footer (Penpot "Layout / Footer"): soft background, brand block
 * with tagline, three link columns and the copyright / trust bar.
 * Client component so it can be rendered from any page composition.
 */
export function StoreFooter() {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const t = getDict(locale);
  return (
    <footer className="mt-[40px] h-[120px] overflow-hidden bg-surface-soft md:mt-[50px] md:h-[220px] lg:mt-[72px] lg:h-[300px]">
      <div className="vd-container py-[16px] md:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <p className="text-center text-[22px] font-extrabold tracking-tight text-ink md:text-start md:text-3xl">VENDORA</p>
            <p className="hidden mt-2 text-sm font-medium text-vd-muted md:block">{t.footer.tagline}</p>
            <div className="mt-6 hidden gap-2 md:flex" aria-hidden>
              {(["jade", "clay", "steel"] as const).map((color) => (
                <span key={color} className="flex h-12 w-12 items-center justify-center rounded-control bg-white">
                  <BagArtwork color={color} className="h-9 w-auto" />
                </span>
              ))}
            </div>
          </div>
          {t.footer.columns.map((column, columnIndex) => (
            <nav key={column.title} aria-label={column.title} className="hidden md:block">
              <p className="text-[0.9375rem] font-bold text-ink">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((label, linkIndex) => (
                  <li key={label}>
                    <Link
                      href={footerLinkHref(columnIndex, linkIndex, locale)}
                      className="vd-focus rounded-sm text-[0.8125rem] text-vd-muted hover:text-jade"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-[2px] text-center text-[12px] text-vd-muted md:hidden">{t.footer.columns.map(c=>c.title).join(" · ")}</p>
        <hr className="mt-[4px] border-vd-line md:mt-10" />
        <div className="mt-[4px] flex flex-col items-center justify-between gap-2 md:mt-5 md:flex-row">
          <p className="vd-text-caption text-vd-muted">{t.footer.copyright}</p>
          <p className="vd-text-caption hidden font-semibold text-jade md:block">{t.footer.trust}</p>
        </div>
      </div>
    </footer>
  );
}

/** Maps the designed footer labels onto real storefront routes. */
function footerLinkHref(column: number, index: number, locale: Locale): string {
  if (column === 0) return withLocalePath("/shop", locale);
  if (column === 1) {
    if (index === 0) return withLocalePath("/account/orders", locale);
    if (index === 2) return withLocalePath("/account/returns", locale);
    return withLocalePath("/faq", locale);
  }
  if (index === 0) return withLocalePath("/about", locale);
  if (index === 2) return withLocalePath("/contact", locale);
  return withLocalePath("/contact", locale);
}
