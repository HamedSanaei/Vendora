"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProductSummary } from "@/lib/vendora/types";
import { getDict } from "@/lib/vendora/i18n";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { formatPrice } from "@/lib/vendora/format";
import { HeartIcon } from "@/components/vendora/icons";
import { BagArtwork, type ArtworkColor } from "./bag-artwork";

export interface ProductCardProps {
  product: ProductSummary;
  locale: "fa" | "en";
  favorited?: boolean;
  onToggleFavorite?: () => void;
  onAddToCart?: () => void;
  artworkColor?: ArtworkColor;
}

/** Responsive Penpot product card: 166×324, 216×360 and 240×386. */
export function ProductCard({ product, locale, favorited = false, onToggleFavorite, onAddToCart, artworkColor = "jade" }: ProductCardProps) {
  const t = getDict(locale);
  const name = locale === "fa" ? product.name : product.nameEn;
  const meta = locale === "fa" ? product.meta : product.metaEn;
  const badge = product.badge ? (locale === "fa" ? product.badge.label : product.badge.labelEn) : null;
  const productHref = withLocalePath(`/product-details/${product.slug}`, locale);
  return (
    <article className="group relative h-full w-full overflow-hidden rounded-[14px] border border-vd-line bg-white transition-shadow hover:shadow-pop lg:rounded-card">
      <div className="absolute inset-x-[10px] top-[10px] flex h-[154px] items-center justify-center overflow-hidden rounded-[10px] bg-surface-soft md:h-[180px] lg:inset-x-3 lg:top-3 lg:h-[210px] lg:rounded-control">
        <Link href={productHref} aria-label={name} className="vd-focus absolute inset-0 z-10" />
        {badge ? <span className="absolute start-1/2 top-2 hidden -translate-x-1/2 rounded-full bg-jade-tint px-2 py-0.5 text-xs font-semibold text-jade rtl:translate-x-1/2 md:block lg:top-2.5">{badge}</span> : null}
        <BagArtwork color={artworkColor} className="h-[118px] w-auto transition-transform duration-300 group-hover:scale-105 md:h-[138px] lg:h-[156px]" />
      </div>

      <div className="absolute inset-x-3 top-[174px] h-[46px] md:inset-x-[14px] md:top-[200px] md:h-[50px] lg:inset-x-4 lg:top-[232px] lg:h-[54px]">
        <h3 className="line-clamp-2 h-full text-[13px] font-semibold leading-[1.4] text-ink md:text-sm lg:pe-[52px] lg:text-[15px]"><Link href={productHref} className="vd-focus rounded-sm hover:text-jade">{name}</Link></h3>
        {onToggleFavorite ? <button type="button" onClick={onToggleFavorite} aria-pressed={favorited} aria-label={favorited ? t.productCard.removeFromWishlist : t.productCard.addToWishlist} className={`vd-focus absolute end-0 top-0 hidden h-9 w-9 items-center justify-center rounded-full border border-vd-line bg-white lg:flex ${favorited ? "text-vd-danger" : "text-ink hover:text-vd-danger"}`}><HeartIcon size={18} filled={favorited} /></button> : null}
      </div>

      <p className="absolute inset-x-[14px] top-[252px] hidden h-[26px] items-center truncate text-xs leading-[1.4] text-vd-muted md:flex lg:inset-x-4 lg:top-[286px] lg:h-7">{meta}</p>
      <p data-price className="absolute inset-x-3 top-[226px] h-7 text-sm font-bold leading-7 text-ink md:inset-x-[14px] md:top-[284px] md:h-[30px] md:text-[15px] lg:inset-x-4 lg:top-[320px] lg:text-base">{formatPrice(product.price, locale)}</p>
      <button type="button" onClick={onAddToCart} aria-label={`${t.productCard.addToCart}: ${name}`} className="vd-focus absolute inset-x-3 top-[266px] flex h-[42px] items-center justify-center rounded-control bg-jade text-[13px] font-bold text-white hover:bg-jade-dark md:inset-x-[14px] md:top-[334px] md:h-1.5 md:rounded-[3px] md:text-[0px] lg:inset-x-4 lg:top-[356px]"><span className="md:hidden">{t.productCard.addToCart}</span></button>
    </article>
  );
}

/** Resolves locale for client-only legacy call sites. */
export function LocaleAwareProductCard(props: Omit<ProductCardProps, "locale">) {
  const pathname = usePathname();
  return <ProductCard {...props} locale={getLocaleFromPathname(pathname)} />;
}
