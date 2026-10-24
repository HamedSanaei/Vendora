import { apiSlice } from "../../api/apiSlice";
import { set_client_secret } from "./orderSlice";
import axios from "axios";
import { http } from "@/lib/http";

async function orderRequest(path, body, token, method = "POST", idempotencyKey) {
  try {
    const response = await http.request({ url: path.replace(/^\/api\//, "/"), method, data: body,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) } });
    return { data: response.data };
  } catch (error) {
    return { error: { status: axios.isAxiosError(error) ? error.response?.status ?? "FETCH_ERROR" : "FETCH_ERROR",
      data: axios.isAxiosError(error) ? error.response?.data ?? { message: "Request failed." } : { message: "Request failed." } } };
  }
}

export const orderApi = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    createPaymentIntent: builder.mutation({
      queryFn: async () => ({ data: { clientSecret: "local-development-payment" } }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(set_client_secret(result.data?.clientSecret));
        } catch {
          // ignored in local development
        }
      },
    }),
    addOrder: builder.mutation({
      async queryFn(data) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        const { idempotencyKey, ...payload } = data;
        const result = await orderRequest("/api/Orders", payload, localAuth?.accessToken, "POST", idempotencyKey);
        if (result.data) {
          localStorage.removeItem("couponInfo");
          localStorage.removeItem("cart_products");
          localStorage.removeItem("shipping_info");
        }

        return result;
      },
    }),
  }),
});

export const {
  useCreatePaymentIntentMutation,
  useAddOrderMutation,
} = orderApi;
