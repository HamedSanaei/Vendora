"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";
import { ChevronIcon, CloseIcon, HeartIcon } from "@/components/vendora/icons";
import { formatNumber } from "@/lib/vendora/format";
import type { Locale } from "@/lib/vendora/types";
import { getCatalogCopy } from "./catalog-copy";
import { isVendoraProductImage, type CatalogProductModel } from "./catalog-types";

interface ProductGalleryProps {
  product: CatalogProductModel;
  locale: Locale;
  favorited: boolean;
  onFavorite: () => void;
}

/** Extends the existing product media/thumbnails with a native modal, retaining one selected image. */
export function ProductGallery({ product, locale, favorited, onFavorite }: ProductGalleryProps) {
  const t = getCatalogCopy(locale);
  const gallery = useMemo(() => {
    const images = product.gallery.filter(isVendoraProductImage);
    return images.length ? images : [""];
  }, [product.gallery]);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = Math.min(selected, gallery.length - 1);
  const image = gallery[active];
  const alt = product.galleryAlts[product.gallery.indexOf(image)] || product.title;
  const close = useCallback(() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }, []);

  return <div className="vd-product-hero__gallery min-w-0">
    <div className="vd-product-hero__media relative aspect-[1.08/1] overflow-hidden rounded-[22px] border border-vd-line bg-surface-soft md:aspect-[1.18/1] lg:aspect-square">
      <button type="button" onClick={onFavorite} aria-label={favorited ? t.removeFromWishlist : t.addToWishlist} aria-pressed={favorited} className={`vd-focus absolute start-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-vd-line shadow-sm ${favorited ? "bg-vd-danger-tint text-vd-danger" : "bg-white/95 text-ink hover:text-vd-danger"}`}><HeartIcon size={20} filled={favorited} /></button>
      <button ref={trigger} type="button" onClick={() => setExpanded(true)} aria-label={`${t.openGallery}: ${product.title}`} aria-haspopup="dialog" className="vd-focus vd-product-gallery__open">
        {image ? <Image src={image} alt={alt} fill priority unoptimized={image.includes("/uploads/")} sizes="(max-width: 1023px) 92vw, 42vw" className="object-contain" /> : <BagArtwork color="jade" className="h-[58%] w-auto" />}
      </button>
    </div>
    {gallery.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{gallery.map((src, index) => <button key={src} type="button" onClick={() => setSelected(index)} aria-label={`${product.title} ${formatNumber(index + 1, locale)}`} aria-pressed={active === index} className={`vd-focus relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-control border bg-surface-soft ${active === index ? "border-jade ring-1 ring-jade" : "border-vd-line"}`}><Image src={src} alt="" fill unoptimized={src.includes("/uploads/")} sizes="72px" className="object-contain" /></button>)}</div>}
    {expanded && <GalleryDialog key={product.id} gallery={gallery} product={product} locale={locale} selected={active} onSelect={setSelected} onClose={close} />}
  </div>;
}

interface GalleryDialogProps {
  gallery: string[];
  product: CatalogProductModel;
  locale: Locale;
  selected: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

/** Native dialog provides focus containment/background isolation; closing keeps the short exit transition. */
function GalleryDialog({ gallery, product, locale, selected, onSelect, onClose }: GalleryDialogProps) {
  const t = getCatalogCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbnails = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const labelId = useId();
  const src = gallery[selected];
  const multiple = gallery.length > 1;

  /** Wraps next/previous selection without changing the route or underlying cart/wishlist state. */
  const move = (offset: number) => onSelect((selected + offset + gallery.length) % gallery.length);
  /** Delays unmount for the exit effect, except when reduced motion is requested. */
  const requestClose = () => {
    if (timer.current) return;
    setClosing(true);
    // Remove native background isolation before restoring focus to the page's image trigger.
    const finish = () => { dialog.current?.close(); onClose(); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else timer.current = setTimeout(finish, 180);
  };

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { if (timer.current) clearTimeout(timer.current); element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    thumbnails.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [selected]);

  return <dialog ref={dialog} aria-modal="true" aria-labelledby={labelId} dir={locale === "fa" ? "rtl" : "ltr"} className={`vd-root vd-product-lightbox ${closing ? "is-closing" : ""}`}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) requestClose(); }}
    onKeyDown={event => {
      // Keep both Tab directions within gallery controls, including at browser chrome boundaries.
      if (event.key === "Tab") {
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        if (multiple) move((event.key === "ArrowLeft") === (locale === "fa") ? 1 : -1);
      }
    }}>
    <header className="vd-product-lightbox__header">
      <div><h2 id={labelId}>{t.gallery}</h2><p>{product.title}</p></div>
      <button type="button" autoFocus onClick={requestClose} className="vd-focus vd-product-lightbox__control" aria-label={t.closeGallery}><CloseIcon size={24} /></button>
    </header>
    <div className="vd-product-lightbox__stage" onClick={event => { if (event.target === event.currentTarget) requestClose(); }}
      onPointerDown={event => { if (event.pointerType === "touch") gesture.current = { x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { gesture.current = null; }}
      onPointerUp={event => {
        const start = gesture.current; gesture.current = null;
        if (!start || !multiple) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move((dx > 0) === (locale === "fa") ? 1 : -1);
      }}>
      <GalleryImage key={src} src={src} alt={product.galleryAlts[product.gallery.indexOf(src)] || product.title} errorText={t.imageUnavailable} loadingText={t.imageLoading} />
      {multiple && <>
        <button type="button" onClick={() => move(-1)} className="vd-focus vd-product-lightbox__control vd-product-lightbox__previous" aria-label={t.previousImage}><span className="rotate-180"><ChevronIcon size={24} /></span></button>
        <button type="button" onClick={() => move(1)} className="vd-focus vd-product-lightbox__control vd-product-lightbox__next" aria-label={t.nextImage}><ChevronIcon size={24} /></button>
      </>}
    </div>
    <footer className="vd-product-lightbox__footer" onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <p aria-live="polite" aria-atomic="true">{formatNumber(selected + 1, locale)} / {formatNumber(gallery.length, locale)}</p>
      {multiple && <div ref={thumbnails} className="vd-product-lightbox__thumbnails">{gallery.map((image, index) => <button type="button" key={image} aria-label={`${product.title} ${formatNumber(index + 1, locale)}`} aria-pressed={selected === index} onClick={() => onSelect(index)} className="vd-focus"><Image src={image} alt="" fill unoptimized={image.includes("/uploads/")} sizes="64px" className="object-contain" /></button>)}</div>}
    </footer>
  </dialog>;
}

/** Contains each image's load/error state; its real image box leaves surrounding space dismissible. */
function GalleryImage({ src, alt, errorText, loadingText }: { src: string; alt: string; errorText: string; loadingText: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src) return <BagArtwork color="jade" className="vd-product-lightbox__artwork" />;
  if (failed) return <p role="status" className="vd-product-lightbox__error">{errorText}</p>;
  return <>
    {!loaded && <span role="status" className="vd-product-lightbox__loading">{loadingText}</span>}
    <Image src={src} alt={alt} width={1800} height={1800} unoptimized={src.includes("/uploads/")} sizes="(max-width: 767px) 96vw, 90vw" loading="eager" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`vd-product-lightbox__image ${loaded ? "is-loaded" : ""}`} />
  </>;
}
