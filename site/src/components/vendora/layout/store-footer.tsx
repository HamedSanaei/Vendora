"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useBrandCopy, useStoreSettings, storePresentation } from './store-settings-provider';
import { resolveApiImageUrl } from '@/lib/http';
import type { Locale } from "@/lib/vendora/types";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";

const officialEnamadHref = "https://trustseal.enamad.ir/?id=8380573&Code=UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu";
const officialEnamadImageUrl = "https://trustseal.enamad.ir/logo.aspx?id=8380573&Code=UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu";
// Exact, unchanged seal markup provided by eNamad for vendorashop.ir.
const officialEnamadHtml = `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=8380573&Code=UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=8380573&Code=UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu' alt='' style='cursor:pointer' code='UiH46UWJfvaEBVduFEdA9IxWc9uXcYQu'></a>`;


/**
 * Storefront footer (Penpot "Layout / Footer"): soft background, brand block
 * with tagline, three link columns and the copyright / trust bar.
 * Client component so it can be rendered from any page composition.
 */
export function StoreFooter() {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const t = useBrandCopy(locale);
  const profile = useStoreSettings();
  const brand = storePresentation(profile, locale);
  const showEnamad = Boolean(profile.enamadEnabled && profile.enamad);
  const expanded = Boolean(profile.logoUrl || profile.nameFa || profile.nameEn || profile.taglineFa || profile.taglineEn || profile.introFa || profile.introEn || profile.phone || profile.email || brand.address || brand.hours || profile.socialProfiles || profile.enamadEnabled || profile.copyrightFa || profile.copyrightEn);
  return (
    <footer className={`mt-[40px] bg-surface-soft md:mt-[50px] lg:mt-[72px] ${expanded ? 'min-h-[120px]' : 'h-[120px] overflow-hidden md:h-[220px] lg:h-[300px]'}`}>
      <div className="vd-container py-[16px] md:py-14">
        <div className={`grid gap-10 ${showEnamad ? 'md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_max-content] md:gap-5 lg:gap-10' : 'md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]'}`}>
          <div className="min-w-0">
            {profile.logoUrl ? <Image unoptimized width={180} height={48} src={resolveApiImageUrl(profile.logoUrl)} alt={brand.name} className="mx-auto h-12 max-w-[180px] object-contain md:mx-0" /> : <p className="break-words text-center text-[22px] font-extrabold tracking-tight text-ink md:text-start md:text-3xl">{brand.wordmark}</p>}
            <p className={`${expanded ? '' : 'hidden md:block'} mt-2 text-sm font-medium text-vd-muted`}>{brand.intro || t.footer.tagline}</p>
            {expanded && <div className="mt-4 space-y-2 text-sm leading-7 text-vd-muted">
              {profile.phone && <p><a className="vd-focus" dir="ltr" href={`tel:${profile.phone.replace(/[^+0-9]/g, '')}`}>{profile.phone}</a></p>}
              {profile.email && <p><a className="vd-focus break-all" dir="ltr" href={`mailto:${profile.email}`}>{profile.email}</a></p>}
              {brand.address && <address className="whitespace-pre-line not-italic">{brand.address}</address>}
              {brand.hours && <p>{brand.hours}</p>}
              {profile.socialProfiles && <nav aria-label={locale === 'fa' ? 'شبکه‌های اجتماعی' : 'Social profiles'} className="flex flex-wrap gap-3">{profile.socialProfiles.split('\n').filter(Boolean).map(url => <a className="vd-focus break-all text-jade" key={url} href={url} target="_blank" rel="noopener noreferrer" dir="ltr">{socialLabel(url)}</a>)}</nav>}
            </div>}
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
          {showEnamad && profile.enamad && (
            <div className="flex justify-center md:justify-end" role="group" aria-label={locale === 'fa' ? 'نماد اعتماد الکترونیکی' : 'eNamad trust seal'}>
              {profile.enamad.href === officialEnamadHref && profile.enamad.imageUrl === officialEnamadImageUrl
                ? <span dangerouslySetInnerHTML={{ __html: officialEnamadHtml }} />
                : <a className="vd-focus inline-block" href={profile.enamad.href} target="_blank" rel="noopener" referrerPolicy="origin"><Image unoptimized src={profile.enamad.imageUrl} referrerPolicy="origin" alt={locale === 'fa' ? 'نماد اعتماد الکترونیکی؛ مشاهده اعتبار' : 'eNamad: verify trust seal'} width={100} height={100} className="h-[100px] w-[100px] object-contain" /></a>}
            </div>
          )}
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

/** Uses a readable host name for social links without requiring a fixed list of providers. */
function socialLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
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
