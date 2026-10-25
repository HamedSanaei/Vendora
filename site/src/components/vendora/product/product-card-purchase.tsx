"use client";

import { createPopper } from "@popperjs/core";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CartIcon, CloseIcon } from "@/components/vendora/icons";
import { QuantityStepper } from "@/components/vendora/cart/cart-components";
import { getCatalogCopy } from "@/components/vendora/catalog/catalog-copy";
import { getDict } from "@/lib/vendora/i18n";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";

interface ProductCardPurchaseProps {
  locale: Locale;
  title: string;
  price: number;
  oldPrice?: number;
  stock?: number;
  quantity?: number;
  onAdd?: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
}

/** One Penpot price/square action row; quantity edits reuse the existing cart control and callbacks. */
export function ProductCardPurchase({ locale, title, price, oldPrice, stock = Infinity, quantity = 0, onAdd, onIncrease, onDecrease }: ProductCardPurchaseProps) {
  const copy = getCatalogCopy(locale), t = getDict(locale);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const managesQuantity = quantity > 0 && Boolean(onIncrease && onDecrease);
  const showPanel = open && managesQuantity;
  const atMaximum = quantity > 0 && quantity >= stock;
  const disabled = !managesQuantity && (!onAdd || stock < 1);

  /** Restores focus only for explicit dismissal, without stealing an outside click's focus. */
  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (quantity < 1 && open) close(true);
  }, [quantity, open, close]);

  useEffect(() => {
    if (!showPanel || !trigger.current || !panel.current) return;
    const surface = panel.current;
    const positioner = createPopper(trigger.current, surface, {
      strategy: "fixed", placement: locale === "fa" ? "top-end" : "top-start",
      modifiers: [{ name: "offset", options: { offset: [0, 8] } }, { name: "preventOverflow", options: { padding: 8, altAxis: true } }],
    });
    surface.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    /** Dismisses when focus or a pointer moves outside both the square and its shared quantity panel. */
    const outside = (event: Event) => {
      if (event.target instanceof Node && !surface.contains(event.target) && !trigger.current?.contains(event.target)) close();
    };
    /** Escape closes this non-modal surface and returns focus to its original card action. */
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { positioner.destroy(); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [showPanel, locale, close]);

  return <div className="vd-product-card__commerce" dir={locale === "fa" ? "rtl" : "ltr"}>
    <div className="vd-product-card__price">
      {oldPrice !== undefined && <CardPrice value={oldPrice} locale={locale} previous />}
      <CardPrice value={price} locale={locale} />
    </div>
    <div className="vd-product-card__action">
      <button ref={trigger} type="button" disabled={disabled}
        data-state={disabled ? "disabled" : atMaximum ? "maximum" : quantity > 0 ? "in-cart" : "default"}
        aria-label={managesQuantity ? `${t.cart.inCart}؛ ${copy.quantity}: ${formatNumber(quantity, locale)}؛ ${title}` : `${copy.addToCart}: ${title}`}
        aria-haspopup={managesQuantity ? "dialog" : undefined} aria-expanded={managesQuantity ? showPanel : undefined} aria-controls={showPanel ? panelId : undefined}
        onClick={() => { if (managesQuantity) setOpen(value => !value); else onAdd?.(); }}
        className="vd-focus vd-card-purchase__button">
        <span className="vd-card-purchase__visual"><CartIcon size={28} /></span>
        {quantity > 0 && <span aria-hidden className="vd-card-purchase__quantity">{formatNumber(Math.min(99, quantity), locale)}{quantity > 99 ? "+" : ""}</span>}
      </button>
      {showPanel && createPortal(<div ref={panel} id={panelId} role="dialog" aria-label={`${copy.quantity}: ${title}`} dir={locale === "fa" ? "rtl" : "ltr"} className="vd-card-quantity-popover">
        <div className="vd-card-quantity-popover__header"><strong>{copy.quantity}</strong><button type="button" onClick={() => close(true)} aria-label={t.common.close} className="vd-focus"><CloseIcon size={18} /></button></div>
        <p>{title}</p>
        <QuantityStepper locale={locale} quantity={quantity} max={stock} onDecrease={() => onDecrease?.()} onIncrease={() => onIncrease?.()} />
      </div>, document.body)}
    </div>
  </div>;
}

/** Fits unchanged Persian/English numbers into the price area; currency remains accessible at every width. */
function CardPrice({ value, locale, previous = false }: { value: number; locale: Locale; previous?: boolean }) {
  const number = formatNumber(value, locale);
  const style = { "--vd-price-chars": number.length } as CSSProperties;
  return <p style={style} className={previous ? "vd-card-price vd-card-price--previous" : "vd-card-price"}>
    <span className="vd-sr-only">{formatPrice(value, locale)}</span>
    <span aria-hidden className="vd-card-price__number">{number}</span><span aria-hidden className="vd-card-price__unit">{getDict(locale).common.toman}</span>
  </p>;
}
