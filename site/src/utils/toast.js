import React from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  CART_TOAST_CONTAINER_ID,
  CartToastContent,
} from "@components/vendora/feedback/cart-toast";
import { getDict } from "@lib/vendora/i18n";

const notifySuccess = (message) =>
  toast.success(message, {
    position: 'top-center',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
  });

const notifyError = (message) =>
  toast.error(message, {
    position: 'top-center',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
  });

/** Returns the viewport position selected by the approved responsive design. */
const getCartToastPosition = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    ? "bottom-center"
    : "top-center";

/** Keeps cart feedback for one product to a single current message. */
const dismissCartProductToasts = (productId) => {
  ["added", "removed", "restored", "maximum"].forEach((eventName) => {
    toast.dismiss(`cart-${eventName}-${productId}`);
  });
};

/** Displays an actionable cart toast inside the dedicated Vendora viewport. */
const notifyCart = ({ locale, tone, message, actionLabel, onAction, toastId, autoClose = 5000 }) =>
  toast(
    ({ closeToast }) =>
      React.createElement(CartToastContent, {
        locale,
        tone,
        message,
        actionLabel,
        onAction,
        closeToast,
      }),
    {
      containerId: CART_TOAST_CONTAINER_ID,
      position: getCartToastPosition(),
      autoClose,
      closeButton: false,
      closeOnClick: false,
      hideProgressBar: false,
      pauseOnFocusLoss: true,
      pauseOnHover: true,
      draggable: true,
      icon: false,
      role: tone === "warning" ? "alert" : "status",
      toastId,
      className: `vd-cart-toast vd-cart-toast--${tone}`,
      bodyClassName: "vd-cart-toast__body",
      progressClassName: `vd-cart-toast__progress vd-cart-toast__progress--${tone}`,
    }
  );

/** Notifies the customer that a new cart line was created. */
const notifyCartAdded = ({ locale, product, onViewCart }) => {
  const t = getDict(locale).cart;
  dismissCartProductToasts(product._id);
  return notifyCart({
    locale,
    tone: "success",
    message: t.added(product.title),
    actionLabel: t.viewCart,
    onAction: onViewCart,
    toastId: `cart-added-${product._id}`,
  });
};

/** Notifies the customer that a cart line was removed and provides undo. */
const notifyCartRemoved = ({ locale, product, onUndo }) => {
  const t = getDict(locale).cart;
  dismissCartProductToasts(product._id);
  return notifyCart({
    locale,
    tone: "danger",
    message: t.removed(product.title),
    actionLabel: t.undo,
    onAction: onUndo,
    toastId: `cart-removed-${product._id}`,
  });
};

/** Confirms that an undo action restored the removed line. */
const notifyCartRestored = ({ locale, product }) => {
  const t = getDict(locale).cart;
  dismissCartProductToasts(product._id);
  return notifyCart({
    locale,
    tone: "success",
    message: t.restored(product.title),
    toastId: `cart-restored-${product._id}`,
    autoClose: 2500,
  });
};

/** Announces that the requested quantity exceeds the available stock. */
const notifyCartMaximum = ({ locale, product }) => {
  const t = getDict(locale).cart;
  dismissCartProductToasts(product._id);
  return notifyCart({
    locale,
    tone: "warning",
    message: t.maxStock,
    toastId: `cart-maximum-${product._id}`,
  });
};

export {
  ToastContainer,
  notifySuccess,
  notifyError,
  notifyCartAdded,
  notifyCartRemoved,
  notifyCartRestored,
  notifyCartMaximum,
};
