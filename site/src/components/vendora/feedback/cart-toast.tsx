"use client";

import { useEffect, useState } from "react";
import { ToastContainer, type ToastPosition } from "react-toastify";
import { CheckIcon, CloseIcon, TrashIcon } from "@/components/vendora/icons";
import type { Locale } from "@/lib/vendora/types";

export const CART_TOAST_CONTAINER_ID = "vendora-cart";

export type CartToastTone = "success" | "danger" | "warning";

export interface CartToastContentProps {
  locale: Locale;
  tone: CartToastTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  closeToast?: () => void;
}

/** Presents localized cart feedback with an optional navigational or undo action. */
export function CartToastContent({ locale, tone, message, actionLabel, onAction, closeToast }: CartToastContentProps) {
  const isRtl = locale === "fa";

  /** Closes the current toast before executing its optional action. */
  const handleAction = () => {
    closeToast?.();
    onAction?.();
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="vd-cart-toast__content">
      <span aria-hidden="true" className={`vd-cart-toast__icon vd-cart-toast__icon--${tone}`}>
        {tone === "success" ? <CheckIcon size={19} /> : null}
        {tone === "danger" ? <TrashIcon size={19} /> : null}
        {tone === "warning" ? <span className="text-base font-extrabold">!</span> : null}
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-bold leading-6 text-ink md:text-sm">{message}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={handleAction} className={`vd-focus mt-1 min-h-8 rounded-control px-2 text-xs font-extrabold vd-cart-toast__action--${tone}`}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <button type="button" onClick={closeToast} aria-label={isRtl ? "بستن پیام" : "Close notification"} className="vd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-vd-muted hover:bg-black/5 hover:text-ink">
        <CloseIcon size={18} />
      </button>
    </div>
  );
}

/** Mounts the dedicated responsive viewport used only by cart feedback toasts. */
export function CartToastViewport() {
  const [position, setPosition] = useState<ToastPosition>("top-center");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updatePosition = () => setPosition(media.matches ? "bottom-center" : "top-center");

    updatePosition();
    media.addEventListener("change", updatePosition);
    return () => media.removeEventListener("change", updatePosition);
  }, []);

  return (
    <ToastContainer
      containerId={CART_TOAST_CONTAINER_ID}
      position={position}
      autoClose={5000}
      newestOnTop
      closeButton={false}
      closeOnClick={false}
      pauseOnFocusLoss
      pauseOnHover
      draggable
      limit={3}
      className="vd-cart-toast-viewport"
    />
  );
}
