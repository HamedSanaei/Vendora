import { createSlice } from "@reduxjs/toolkit";
import { getLocalStorage, setLocalStorage } from "@utils/localstorage";
import { notifyError, notifySuccess } from "@utils/toast";

const initialState = {
  wishlist: [],
  hydrated: false,
};

export const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    add_to_wishlist: (state, { payload }) => {
        state.hydrated = true;
        const isExist = state.wishlist.some(item => item._id === payload._id);
        if(!isExist){
            state.wishlist.push(payload);
            notifySuccess(`${payload.title} added to wishlist`)
        }
        else {
            state.wishlist = state.wishlist.filter(item => item._id !== payload._id);
            notifyError(`${payload.title} removed from wishlist`);
        }
      setLocalStorage("wishlist_items", state.wishlist);
    },
    remove_wishlist_product: (state, { payload }) => {
      state.hydrated = true;
      state.wishlist = state.wishlist.filter((item) => item._id !== payload._id);
      notifyError(`${payload.title} removed from wishlist`);
      setLocalStorage("wishlist_items", state.wishlist);
    },
    clear_wishlist: (state) => {
      state.hydrated = true;
      state.wishlist = [];
      setLocalStorage("wishlist_items", state.wishlist);
    },
    get_wishlist_products: (state) => {
      state.wishlist = getLocalStorage("wishlist_items");
      state.hydrated = true;
    },
  },
});

export const {
  add_to_wishlist,
  remove_wishlist_product,
  clear_wishlist,
  get_wishlist_products,
} = wishlistSlice.actions;
export default wishlistSlice.reducer;
