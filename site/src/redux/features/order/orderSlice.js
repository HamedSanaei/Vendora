import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  shipping_info: {},
  payment_info: {
    provider: "zarinpal",
    notes: "",
  },
  stripe_client_secret:"",
};

export const orderSlice = createSlice({
  name: "order",
  initialState,
  reducers: {
    set_shipping: (state, { payload }) => {
      state.shipping_info = payload;
      localStorage.setItem(
        "shipping_info",
        JSON.stringify(payload)
      );
    },
    get_shipping: (state, { payload }) => {
      const data = localStorage.getItem('shipping_info');
      if (data) {
        state.shipping_info = JSON.parse(data);
      } else {
        state.shipping_info = {};
      }
      
    },
    set_payment: (state, { payload }) => {
      state.payment_info = {
        ...state.payment_info,
        ...payload,
      };
      localStorage.setItem("payment_info", JSON.stringify(state.payment_info));
    },
    get_payment: (state) => {
      const data = localStorage.getItem("payment_info");
      state.payment_info = data
        ? JSON.parse(data)
        : { provider: "zarinpal", notes: "" };
    },
    reset_checkout: (state) => {
      state.shipping_info = {};
      state.payment_info = { provider: "zarinpal", notes: "" };
      state.stripe_client_secret = "";
      localStorage.removeItem("shipping_info");
      localStorage.removeItem("payment_info");
    },
    set_client_secret:(state,{payload}) => {
      state.stripe_client_secret = payload;
    }
  },
});

export const {get_shipping,set_shipping,set_payment,get_payment,reset_checkout,set_client_secret} = orderSlice.actions;
export default orderSlice.reducer;
