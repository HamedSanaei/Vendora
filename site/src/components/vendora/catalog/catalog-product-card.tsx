"use client";

import Image from "next/image";
import Link from "next/link";
import { BagArtwork, type ArtworkColor } from "@/components/vendora/product/bag-artwork";
import { CartIcon, HeartIcon } from "@/components/vendora/icons";
import { QuantityStepper } from "@/components/vendora/cart/cart-components";
import { formatPrice } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { getCatalogCopy } from "./catalog-copy";
import { isVendoraProductImage, type CatalogProductModel } from "./catalog-types";

export interface CatalogProductCardProps {
  product: CatalogProductModel;
  locale: Locale;
  compact?: boolean;
  favorited?: boolean;
  artworkColor?: ArtworkColor;
  cartQuantity?: number;
  onAddToCart?: (product: CatalogProductModel) => void;
  onIncreaseCart?: (product: CatalogProductModel) => void;
  onDecreaseCart?: (product: CatalogProductModel) => void;
  onToggleFavorite?: (product: CatalogProductModel) => void;
}

/** Reusable commerce card for catalog grids, recommendations and carousels. */
export function CatalogProductCard({ product, locale, compact = false, favorited = false, artworkColor = "jade", cartQuantity = 0, onAddToCart, onIncreaseCart, onDecreaseCart, onToggleFavorite }: CatalogProductCardProps) {
  const t = getCatalogCopy(locale);
  const href = withLocalePath(`/product-details/${product.id}`, locale);
  const hasCartQuantity = cartQuantity > 0;
  const handleInitialAdd = onIncreaseCart ?? onAddToCart;

  return (
    <article className={`vd-product-card group relative flex h-auto min-h-[382px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-vd-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#c9d8d2] hover:shadow-[0_18px_46px_-30px_rgba(0,77,58,.55)] md:min-h-[410px] ${compact ? "p-2.5 md:p-3" : "p-3 md:p-4"}`}>
      <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-surface-soft ${compact ? "aspect-square" : "aspect-[1.12/1]"}`}>
        <Link href={href} aria-label={product.title} className="vd-focus absolute inset-0 z-10 rounded-[14px]" />
        {product.stock > 0 ? <span className="absolute start-2 top-2 z-20 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-jade shadow-sm md:start-3 md:top-3 md:text-xs">{t.freeShipping}</span> : null}
        {product.image && isVendoraProductImage(product.image) ? (
          <Image src={product.image} alt={product.title} fill unoptimized={product.image.includes("/uploads/")} sizes="(max-width: 767px) 46vw, (max-width: 1279px) 30vw, 240px" className="object-cover transition-transform duration-300 group-hover:scale-[1.035]" />
        ) : (
          <BagArtwork color={artworkColor} className="h-[62%] w-auto transition-transform duration-300 group-hover:scale-105" />
        )}
        {onToggleFavorite ? (
          <button type="button" onClick={() => onToggleFavorite(product)} aria-label={favorited ? t.removeFromWishlist : t.addToWishlist} aria-pressed={favorited} className={`vd-focus absolute end-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-vd-line bg-white/95 md:end-3 md:top-3 ${favorited ? "text-vd-danger" : "text-ink hover:text-vd-danger"}`}>
            <HeartIcon size={18} filled={favorited} />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-3 md:pt-4">
        <h2 className="line-clamp-2 min-h-[46px] text-[14px] font-bold leading-[1.65] text-ink md:min-h-[52px] md:text-[16px]"><Link href={href} className="vd-focus rounded-sm hover:text-jade">{product.title}</Link></h2>
        {product.stock < 1 ? <p className="mt-1 text-[11px] font-bold text-vd-danger">{t.unavailable}</p> : null}
        <div className="vd-product-card__commerce mt-auto min-h-[48px] pt-3">
          <div className="vd-product-card__price min-w-0">
            {product.oldPrice ? <p className="text-[11px] text-vd-muted line-through">{formatPrice(product.oldPrice, locale)}</p> : null}
            <p className="whitespace-nowrap text-[13px] font-extrabold text-ink md:text-[15px]">{formatPrice(product.price, locale)}</p>
          </div>
          <div className="vd-product-card__action">
            {hasCartQuantity && onIncreaseCart && onDecreaseCart ? (
              <QuantityStepper locale={locale} quantity={cartQuantity} max={product.stock} size="card" onDecrease={() => onDecreaseCart(product)} onIncrease={() => onIncreaseCart(product)} />
            ) : handleInitialAdd ? (
              <button type="button" onClick={() => handleInitialAdd(product)} aria-label={`${t.addToCart}: ${product.title}`} disabled={product.stock < 1} className="vd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-jade text-white transition-colors hover:bg-jade-dark disabled:bg-vd-line disabled:text-vd-muted">
                <CartIcon size={19} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
