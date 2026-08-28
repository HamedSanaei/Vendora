"use client";

import Image from "next/image";
import Link from "next/link";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";
import { isVendoraProductImage } from "@/components/vendora/catalog/catalog-types";
import { CheckIcon, CreditCardIcon, QualityIcon, SupportIcon, TrashIcon, TruckIcon } from "@/components/vendora/icons";
import { getSafeImageProps } from "@/lib/image-source";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { withLocalePath } from "@/lib/locale-path";
import { getCartArtworkColor, getCartUnitPrice, type CartLine } from "./cart-model";
export { CheckoutStepper } from "@/components/vendora/checkout/checkout-stepper";

interface QuantityStepperProps {
  locale: Locale;
  quantity: number;
  max?: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  size?: "card" | "compact" | "regular";
  className?: string;
}

/** Reusable direction-aware cart control shared by cards, product panels and cart lines. */
export function QuantityStepper({ locale, quantity, max, onDecrease, onIncrease, compact = false, size, className = "" }: QuantityStepperProps) {
  const t = getDict(locale).cart;
  const hasMaximum = Number.isFinite(max);
  const atMaximum = hasMaximum && quantity >= Number(max);
  const atMinimum = quantity <= 1;
  const resolvedSize = size ?? (compact ? "compact" : "regular");
  const sizeClass = resolvedSize === "card" ? "h-11 w-[132px]" : resolvedSize === "compact" ? "h-11 w-[132px]" : "h-12 w-[136px]";

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} data-state={atMaximum ? "maximum" : atMinimum ? "minimum" : "default"} className={`grid ${sizeClass} grid-cols-[1fr_44px_1fr] overflow-hidden rounded-control border border-vd-line bg-white ${className}`}>
      <button type="button" onClick={onDecrease} aria-label={atMinimum ? t.remove : t.decrease} className={`vd-focus flex min-h-11 items-center justify-center text-xl font-medium hover:bg-surface-soft ${atMinimum ? "text-vd-danger" : "text-ink"}`}>
        {atMinimum ? <TrashIcon size={18} /> : "−"}
      </button>
      <output aria-live="polite" className="flex items-center justify-center border-x border-vd-line text-sm font-bold text-ink">{formatNumber(quantity, locale)}</output>
      <button type="button" onClick={onIncrease} aria-label={atMaximum ? t.maxStock : t.increase} aria-disabled={atMaximum} title={atMaximum ? t.maxStock : undefined} className={`vd-focus flex min-h-11 items-center justify-center text-xl font-medium hover:bg-surface-soft ${atMaximum ? "cursor-not-allowed bg-surface-soft text-vd-muted" : "text-jade"}`}>+</button>
    </div>
  );
}

interface CartProductMediaProps {
  item: CartLine;
  locale: Locale;
  compact?: boolean;
}

/** Displays a real Vendora product image, with the Penpot bag artwork as a safe fallback. */
export function CartProductMedia({ item, locale, compact = false }: CartProductMediaProps) {
  const hasProductImage = Boolean(item.image && isVendoraProductImage(item.image));
  const imageLabel = locale === "fa" ? `تصویر ${item.title}` : `${item.title} image`;

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-card bg-surface-soft ${compact ? "h-[82px] w-[82px]" : "h-[148px] w-full md:h-[112px] md:w-[136px]"}`}>
      {hasProductImage ? (
        <Image {...getSafeImageProps(item.image)} alt={imageLabel} fill sizes={compact ? "82px" : "(max-width: 767px) 148px, 136px"} className="object-contain p-2" />
      ) : (
        <BagArtwork color={getCartArtworkColor(item._id)} className={compact ? "h-[68px] w-auto" : "h-[104px] w-auto md:h-[88px]"} />
      )}
    </div>
  );
}

interface CartItemProps {
  item: CartLine;
  locale: Locale;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}

/** Responsive cart line matching the approved desktop row and mobile card. */
export function CartItem({ item, locale, onDecrease, onIncrease, onRemove }: CartItemProps) {
  const t = getDict(locale).cart;
  const detailsHref = withLocalePath(`/product-details/${item._id}`, locale);
  const meta = item.category?.name ?? item.parent ?? item.brand?.name ?? t.variantFallback;
  const stock = Number(item.quantity);

  return (
    <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_148px] gap-4 rounded-panel border border-vd-line bg-white p-4 md:min-h-[176px] md:grid-cols-[136px_minmax(0,1fr)_220px] md:items-center md:gap-6 md:p-5">
      <Link href={detailsHref} className="vd-focus row-start-1 rounded-card md:row-auto"><CartProductMedia item={item} locale={locale} /></Link>
      <div className="min-w-0 self-start pt-1 md:self-center md:pt-0">
        <Link href={detailsHref} className="vd-focus line-clamp-2 rounded-sm text-[16px] font-extrabold leading-[1.55] text-ink hover:text-jade md:text-[18px]">{item.title}</Link>
        <p className="mt-2 truncate text-xs text-vd-muted">{meta}{item.sku ? ` · ${item.sku}` : ""}</p>
        <p className="mt-3 text-xs font-bold text-jade">{t.stock}</p>
        <p className="mt-3 text-[16px] font-extrabold text-ink md:hidden">{formatPrice(getCartUnitPrice(item), locale)}</p>
      </div>
      <div className="col-span-2 flex items-center justify-between border-t border-vd-line pt-4 md:col-span-1 md:flex-col md:items-stretch md:border-0 md:pt-0">
        <QuantityStepper locale={locale} quantity={item.orderQuantity} max={stock} onDecrease={onDecrease} onIncrease={onIncrease} />
        <div className="hidden md:block">
          <p className="mt-3 text-xs text-vd-muted">{t.unitPrice}</p>
          <p className="mt-1 text-[16px] font-extrabold text-ink">{formatPrice(getCartUnitPrice(item), locale)}</p>
        </div>
        <button type="button" onClick={onRemove} className="vd-focus flex h-12 min-w-[102px] items-center justify-center gap-2 rounded-control border border-vd-danger px-4 text-sm font-bold text-vd-danger hover:bg-vd-danger-tint md:mt-3 md:h-9 md:min-w-0 md:justify-start md:border-0 md:p-0" aria-label={`${t.remove}: ${item.title}`}><TrashIcon size={17} />{t.remove}</button>
      </div>
    </article>
  );
}

interface CartSummaryProps {
  locale: Locale;
  subtotal: number;
}

/** Reusable order summary used as the desktop side panel and mobile block. */
export function CartSummary({ locale, subtotal }: CartSummaryProps) {
  const t = getDict(locale).cart;

  return (
    <aside className="rounded-tile border border-vd-line bg-white p-6 lg:sticky lg:top-6">
      <h2 className="text-xl font-extrabold text-ink">{t.summaryTitle}</h2>
      <hr className="my-5 border-vd-line" />
      <dl className="space-y-4 text-sm">
        <SummaryLine label={t.subtotal} value={formatPrice(subtotal, locale)} />
        <SummaryLine label={t.shipping} value={t.free} accent />
        <SummaryLine label={t.discount} value={formatPrice(0, locale)} />
      </dl>
      <hr className="my-5 border-vd-line" />
      <div className="flex items-center justify-between gap-3"><span className="font-extrabold text-ink">{t.payable}</span><strong className="text-[17px] font-extrabold text-jade-dark">{formatPrice(subtotal, locale)}</strong></div>
      <Link href={withLocalePath("/shipping", locale)} className="vd-focus mt-6 flex h-14 items-center justify-center rounded-control bg-jade px-4 text-sm font-extrabold text-white hover:bg-jade-dark">{t.checkout}</Link>
      <p className="mt-3 text-center text-xs text-vd-muted">{t.secureNote}</p>
    </aside>
  );
}

/** Displays a label/value pair inside the order summary. */
function SummaryLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-vd-muted">{label}</dt><dd className={`m-0 font-bold ${accent ? "text-jade" : "text-ink"}`}>{value}</dd></div>;
}

/** Trust assurances shown underneath the cart layout. */
export function CartTrustBar({ locale }: { locale: Locale }) {
  const items = getDict(locale).cart.trust;
  const icons = [CreditCardIcon, TruckIcon, QualityIcon, SupportIcon];

  return (
    <section aria-label={locale === "fa" ? "مزایای خرید" : "Shopping benefits"} className="grid gap-5 rounded-tile bg-surface-soft p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-9">
      {items.map((item, index) => {
        const Icon = icons[index];
        return <div key={item.title} className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-jade-tint text-jade"><Icon size={22} /></span><div><h3 className="text-[15px] font-extrabold text-ink">{item.title}</h3><p className="mt-1 text-xs leading-6 text-vd-muted">{item.body}</p></div></div>;
      })}
    </section>
  );
}

/** Empty-cart treatment with a direct route back to the catalogue. */
export function EmptyCartState({ locale }: { locale: Locale }) {
  const t = getDict(locale).cart;
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-tile border border-vd-line bg-white px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-jade-tint text-jade"><CheckIcon size={42} /></span>
      <h2 className="mt-6 text-2xl font-extrabold text-ink">{t.emptyTitle}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-vd-muted">{t.emptyBody}</p>
      <Link href={withLocalePath("/shop", locale)} className="vd-focus mt-7 flex h-12 min-w-48 items-center justify-center rounded-control bg-jade px-6 text-sm font-bold text-white hover:bg-jade-dark">{t.emptyCta}</Link>
    </section>
  );
}
