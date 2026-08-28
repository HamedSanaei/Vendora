import { createSlice } from "@reduxjs/toolkit";
import { getLocalStorage, setLocalStorage } from "@utils/localstorage";

const initialState = {
  cart_products: [],
  orderQuantity: 1,
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    add_cart_product: (state, { payload }) => {
      const isExist = state.cart_products.some((i) => i._id === payload._id);
      if (!isExist) {
        const newItem = {
          ...payload,
          orderQuantity: 1,
        };
        state.cart_products.push(newItem);
      } else {
        state.cart_products.map((item) => {
          if (item._id === payload._id) {
            if (item.quantity >= item.orderQuantity + state.orderQuantity) {
              item.orderQuantity =
                state.orderQuantity !== 1
                  ? state.orderQuantity + item.orderQuantity
                  : item.orderQuantity + 1;
            } else {
              state.orderQuantity = 1;
            }
          }
          return { ...item };
        });
      }
      setLocalStorage("cart_products", state.cart_products);
    },
    increment: (state, { payload }) => {
      state.orderQuantity = state.orderQuantity + 1;
    },
    decrement: (state, { payload }) => {
      state.orderQuantity =
        state.orderQuantity > 1
          ? state.orderQuantity - 1
          : (state.orderQuantity = 1);
    },
    quantityDecrement: (state, { payload }) => {
      const itemIndex = state.cart_products.findIndex(
        (item) => item._id === payload._id
      );

      if (itemIndex >= 0) {
        const item = state.cart_products[itemIndex];
        if (item.orderQuantity > 1) {
          item.orderQuantity -= 1;
        } else {
          state.cart_products.splice(itemIndex, 1);
        }
      }
      setLocalStorage("cart_products", state.cart_products);
    },
    // Increases one cart line while respecting the product stock when it is known.
    quantityIncrement: (state, { payload }) => {
      state.cart_products.forEach((item) => {
        if (item._id !== payload._id) return;

        const stock = Number(item.quantity);
        const hasStockLimit = Number.isFinite(stock);
        if (!hasStockLimit || item.orderQuantity < stock) {
          item.orderQuantity += 1;
        }
      });
      setLocalStorage("cart_products", state.cart_products);
    },
    remove_product: (state, { payload }) => {
      state.cart_products = state.cart_products.filter(
        (item) => item._id !== payload._id
      );
      setLocalStorage("cart_products", state.cart_products);
    },
    // Restores one removed cart line at its previous stable position.
    restore_cart_product: (state, { payload }) => {
      const item = payload?.item;
      if (!item || state.cart_products.some((entry) => entry._id === item._id)) {
        return;
      }

      const requestedIndex = Number(payload.index);
      const index = Number.isFinite(requestedIndex)
        ? Math.min(Math.max(requestedIndex, 0), state.cart_products.length)
        : state.cart_products.length;

      state.cart_products.splice(index, 0, item);
      setLocalStorage("cart_products", state.cart_products);
    },
    // Removes every line from the cart and synchronizes the persisted cart.
    clear_cart: (state) => {
      state.cart_products = [];
      setLocalStorage("cart_products", state.cart_products);
    },
    get_cart_products: (state, action) => {
      state.cart_products = getLocalStorage("cart_products");
    },
    initialOrderQuantity: (state, { payload }) => {
      state.orderQuantity = 1;
    },
  },
});

export const {
  add_cart_product,
  increment,
  decrement,
  get_cart_products,
  remove_product,
  restore_cart_product,
  quantityDecrement,
  quantityIncrement,
  clear_cart,
  initialOrderQuantity,
} = cartSlice.actions;
export default cartSlice.reducer;
