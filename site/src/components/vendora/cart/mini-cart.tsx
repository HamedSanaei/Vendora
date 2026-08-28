"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CloseIcon, TrashIcon } from "@/components/vendora/icons";
import { clear_cart, quantityDecrement, quantityIncrement, remove_product } from "@/redux/features/cartSlice";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { withLocalePath } from "@/lib/locale-path";
import { CartProductMedia, QuantityStepper } from "./cart-components";
import { getCartTotals, getCartUnitPrice, type CartLine } from "./cart-model";

interface MiniCartProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
}

interface MiniCartRootState {
  cart: { cart_products: CartLine[] };
}

/** Responsive desktop popover and mobile bottom sheet connected to the Redux cart. */
export function MiniCart({ open, locale, onClose }: MiniCartProps) {
  const t = getDict(locale).cart;
  const items = useSelector((state: MiniCartRootState) => state.cart.cart_products);
  const dispatch = useDispatch();
  const totals = getCartTotals(items);
  const desktopCloseRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 1279px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    (isMobile ? mobileCloseRef.current : desktopCloseRef.current)?.focus();

    /** Closes the active cart overlay with the standard Escape interaction. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open) return null;

  /** Confirms and clears all cart lines from both Redux and local storage. */
  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) dispatch(clear_cart());
  };

  const contentProps = { items, locale, onClose };

  return (
    <>
      <div className="hidden xl:block">
        <button type="button" tabIndex={-1} aria-label={t.mini.close} onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-transparent" />
        <section role="dialog" aria-modal="true" aria-label={t.mini.title} className="absolute left-7 top-[70px] z-50 w-[408px] overflow-hidden rounded-tile border border-vd-line bg-white shadow-pop">
          <span aria-hidden className="absolute left-7 top-[-7px] h-[18px] w-[18px] rotate-45 border-l border-t border-vd-line bg-white" />
          <header className="relative px-6 pb-4 pt-5">
            <h2 className="text-[19px] font-extrabold text-ink">{t.mini.title}</h2>
            <p className="mt-1 text-xs text-vd-muted">{t.mini.itemCount(formatNumber(totals.itemCount, locale))}</p>
            <button ref={desktopCloseRef} type="button" onClick={onClose} aria-label={t.mini.close} className="vd-focus absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-vd-muted hover:bg-surface-soft hover:text-ink"><CloseIcon size={19} /></button>
          </header>
          <hr className="mx-6 m-0 border-vd-line" />
          <MiniCartContent {...contentProps} />
          {items.length > 0 ? <MiniCartActions locale={locale} subtotal={totals.subtotal} onClear={handleClear} onClose={onClose} /> : null}
          <p className="px-6 pb-5 text-center text-[11px] text-vd-muted">{t.mini.dismissHint}</p>
        </section>
      </div>

      <div className="fixed inset-0 z-50 xl:hidden">
        <button type="button" tabIndex={-1} aria-label={t.mini.close} onClick={onClose} className="absolute inset-0 bg-ink/[0.52]" />
        <section role="dialog" aria-modal="true" aria-label={t.mini.title} className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-116px)] min-h-[420px] flex-col overflow-hidden rounded-t-[24px] bg-white">
          <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-14 shrink-0 rounded-full bg-[#c9d4d0]" />
          <header className="relative shrink-0 px-4 pb-4 pt-3">
            <h2 className="text-xl font-extrabold text-ink">{t.mini.title}</h2>
            <p className="mt-1 text-xs text-vd-muted">{t.mini.itemCount(formatNumber(totals.itemCount, locale))}</p>
            <button ref={mobileCloseRef} type="button" onClick={onClose} aria-label={t.mini.close} className="vd-focus absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-vd-muted hover:bg-surface-soft"><CloseIcon size={20} /></button>
          </header>
          <hr className="mx-4 m-0 shrink-0 border-vd-line" />
          <MiniCartContent {...contentProps} mobile />
          {items.length > 0 ? <MiniCartActions locale={locale} subtotal={totals.subtotal} onClear={handleClear} onClose={onClose} mobile /> : null}
        </section>
      </div>
    </>
  );
}

/** Scrollable mini-cart item region, shared by both responsive overlay patterns. */
function MiniCartContent({ items, locale, onClose, mobile = false }: { items: CartLine[]; locale: Locale; onClose: () => void; mobile?: boolean }) {
  const t = getDict(locale).cart;
  if (items.length === 0) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
        <h3 className="text-lg font-extrabold text-ink">{t.emptyTitle}</h3>
        <p className="mt-2 text-sm text-vd-muted">{t.emptyBody}</p>
        <Link href={withLocalePath("/shop", locale)} onClick={onClose} className="vd-focus mt-6 flex h-11 items-center justify-center rounded-control bg-jade px-6 text-sm font-bold text-white">{t.emptyCta}</Link>
      </div>
    );
  }

  return (
    <div className={`vd-mini-cart-scroll min-h-0 overflow-y-auto ${mobile ? "max-h-[272px] flex-1" : "max-h-[284px]"}`}>
      {items.map((item) => <MiniCartLine key={item._id} item={item} locale={locale} />)}
    </div>
  );
}

/** Compact line item with the same quantity and removal behavior as the cart page. */
function MiniCartLine({ item, locale }: { item: CartLine; locale: Locale }) {
  const t = getDict(locale).cart;
  const dispatch = useDispatch();
  const stock = Number(item.quantity);
  return (
    <article className="grid min-h-[132px] grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-vd-line px-4 py-3">
      <Link href={withLocalePath(`/product-details/${item._id}`, locale)} className="vd-focus rounded-card"><CartProductMedia item={item} locale={locale} compact /></Link>
      <div className="min-w-0">
        <Link href={withLocalePath(`/product-details/${item._id}`, locale)} className="vd-focus line-clamp-2 rounded-sm text-[14px] font-extrabold leading-6 text-ink hover:text-jade">{item.title}</Link>
        <p className="mt-1 text-xs text-vd-muted">{item.category?.name ?? item.parent ?? t.variantFallback}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div><p className="text-[13px] font-extrabold text-ink">{formatPrice(getCartUnitPrice(item), locale)}</p><button type="button" onClick={() => dispatch(remove_product(item))} className="vd-focus mt-1 flex items-center gap-1 rounded-sm text-xs font-bold text-vd-danger"><TrashIcon size={14} />{t.remove}</button></div>
          <QuantityStepper compact locale={locale} quantity={item.orderQuantity} max={stock} onDecrease={() => dispatch(quantityDecrement(item))} onIncrease={() => dispatch(quantityIncrement(item))} />
        </div>
      </div>
    </article>
  );
}

/** Sticky totals and primary actions shared by the desktop and mobile mini cart. */
function MiniCartActions({ locale, subtotal, onClear, onClose, mobile = false }: { locale: Locale; subtotal: number; onClear: () => void; onClose: () => void; mobile?: boolean }) {
  const t = getDict(locale).cart;
  return (
    <footer className={`shrink-0 border-t border-vd-line bg-white px-6 ${mobile ? "pb-5 pt-4" : "pb-4 pt-5"}`}>
      <dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-vd-muted">{t.subtotal}</dt><dd className="m-0 font-bold text-ink">{formatPrice(subtotal, locale)}</dd></div><div className="flex justify-between gap-3"><dt className="font-extrabold text-ink">{t.mini.total}</dt><dd className="m-0 font-extrabold text-jade-dark">{formatPrice(subtotal, locale)}</dd></div></dl>
      <div className={`mt-5 grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
        <Link href={withLocalePath("/cart", locale)} onClick={onClose} className="vd-focus flex h-14 items-center justify-center rounded-control bg-jade px-4 text-sm font-extrabold text-white hover:bg-jade-dark">{t.mini.viewCart}</Link>
        <button type="button" onClick={onClear} className="vd-focus flex h-14 items-center justify-center rounded-control border border-vd-danger px-4 text-sm font-extrabold text-vd-danger hover:bg-vd-danger-tint">{t.clear}</button>
      </div>
    </footer>
  );
}
