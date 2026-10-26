import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import {
  notifyCartAdded,
  notifyCartMaximum,
  notifyCartRemoved,
  notifyCartRestored,
  notifySuccess,
} from "@utils/toast";
import {
  add_cart_product,
  quantityDecrement,
  quantityIncrement,
  remove_product,
  restore_cart_product,
  sync_cart_prices,
} from "./cartSlice";

export const cartFeedbackListener = createListenerMiddleware();

// A policy/rate revision must be visible to the customer before another checkout confirmation.
cartFeedbackListener.startListening({
  actionCreator: sync_cart_prices,
  effect: (_action, api) => {
    const before = api.getOriginalState().cart.cart_products;
    const after = api.getState().cart.cart_products;
    if (before.some(item => {
      const next = after.find(line => line._id === item._id);
      return next && (Number(next.originalPrice) !== Number(item.originalPrice) || Number(next.discount) !== Number(item.discount));
    })) notifySuccess(getActiveLocale() === "fa" ? "قیمت سبد به‌روز شد؛ مبلغ جدید را بررسی و دوباره تأیید کنید." : "Cart prices changed. Review the new total and confirm again.");
  },
});

/** Resolves the active localized storefront without storing locale in Redux. */
function getActiveLocale() {
  if (typeof window === "undefined") return "fa";
  return getLocaleFromPathname(window.location.pathname);
}

/** Locates the cart line affected by one of the backwards-compatible actions. */
function findCartLine(state, productId) {
  return state.cart.cart_products.find((item) => item._id === productId);
}

/** Returns true when an unchanged increase was rejected by a finite stock limit. */
function reachedMaximum(before, after) {
  if (!before || !after || before.orderQuantity !== after.orderQuantity) return false;
  const stock = Number(before.quantity);
  return Number.isFinite(stock);
}

cartFeedbackListener.startListening({
  matcher: isAnyOf(
    add_cart_product,
    quantityIncrement,
    quantityDecrement,
    remove_product
  ),
  effect: (action, listenerApi) => {
    const previousState = listenerApi.getOriginalState();
    const currentState = listenerApi.getState();
    const productId = action.payload?._id;
    if (!productId) return;

    const previousItem = findCartLine(previousState, productId);
    const currentItem = findCartLine(currentState, productId);
    const locale = getActiveLocale();

    if (add_cart_product.match(action)) {
      if (!previousItem && currentItem) {
        notifyCartAdded({
          locale,
          product: currentItem,
          onViewCart: () => {
            if (typeof window !== "undefined") {
              window.location.assign(withLocalePath("/cart", locale));
            }
          },
        });
        return;
      }

      if (reachedMaximum(previousItem, currentItem)) {
        notifyCartMaximum({ locale, product: previousItem });
      }
      return;
    }

    if (quantityIncrement.match(action)) {
      if (reachedMaximum(previousItem, currentItem)) {
        notifyCartMaximum({ locale, product: previousItem });
      }
      return;
    }

    if (previousItem && !currentItem) {
      const previousIndex = previousState.cart.cart_products.findIndex(
        (item) => item._id === productId
      );

      notifyCartRemoved({
        locale,
        product: previousItem,
        onUndo: () => {
          listenerApi.dispatch(
            restore_cart_product({ item: previousItem, index: previousIndex })
          );
          notifyCartRestored({ locale, product: previousItem });
        },
      });
    }
  },
});
