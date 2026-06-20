import { apiSlice } from "../api/apiSlice";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";

async function orderRequest(path, token) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { error: { status: response.status, data: data ?? { message: "Request failed." } } };
  }

  return { data };
}

function mapOrder(order) {
  const address = order.shippingAddress ?? {};
  return {
    _id: order.orderNumber,
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAtUtc,
    status: String(order.status ?? "").toLowerCase(),
    paymentStatus: order.paymentStatus,
    name: address.recipientName,
    contact: address.phoneNumber,
    country: address.province,
    city: address.city,
    address: address.streetAddress,
    postalCode: address.postalCode,
    shippingCost: order.shippingCost,
    discount: order.discountAmount,
    totalAmount: order.totalAmount,
    cart: (order.items ?? []).map((item) => ({
      _id: item.productId,
      title: item.productTitle,
      orderQuantity: item.quantity,
      originalPrice: item.unitPrice,
      price: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    invoice: order.orderNumber,
    order,
  };
}

export const orderApi = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getUserOrders: builder.query({
      async queryFn() {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        const result = await orderRequest("/api/Orders/me", localAuth?.accessToken);
        return result.data ? { data: { success: true, orders: result.data.map(mapOrder) } } : result;
      },
      keepUnusedDataFor: 600,
    }),
    getUserOrderById: builder.query({
      async queryFn(orderNumber) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        const result = await orderRequest(`/api/Orders/${orderNumber}`, localAuth?.accessToken);
        return result.data ? { data: { success: true, order: mapOrder(result.data) } } : result;
      },
      keepUnusedDataFor: 600,
    }),
  }),
});

export const {
  useGetUserOrdersQuery,
  useGetUserOrderByIdQuery,
} = orderApi;
