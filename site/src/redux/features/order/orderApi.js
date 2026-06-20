import { apiSlice } from "../../api/apiSlice";
import { set_client_secret } from "./orderSlice";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";

async function orderRequest(path, body, token, method = "POST") {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { error: { status: response.status, data: data ?? { message: "Request failed." } } };
  }

  return { data };
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
        const result = await orderRequest("/api/Orders", data, localAuth?.accessToken);
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
