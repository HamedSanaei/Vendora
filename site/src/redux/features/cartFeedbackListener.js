import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";
import {
  notifyCartAdded,
  notifyCartMaximum,
  notifyCartRemoved,
  notifyCartRestored,
} from "@utils/toast";
import {
  add_cart_product,
  quantityDecrement,
  quantityIncrement,
  remove_product,
  restore_cart_product,
} from "./cartSlice";

export const cartFeedbackListener = createListenerMiddleware();

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
