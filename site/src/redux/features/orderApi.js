import { apiSlice } from "../api/apiSlice";
import axios from 'axios';
import { http } from '@/lib/http';

async function orderRequest(path, token) {
  try { return { data: (await http.get(path.replace(/^\/api(?=\/)/, ''), { headers: token ? { Authorization: `Bearer ${token}` } : undefined })).data }; }
  catch (error) { return { error: { status: axios.isAxiosError(error) ? error.response?.status ?? 'NETWORK_ERROR' : 'NETWORK_ERROR', data: axios.isAxiosError(error) ? error.response?.data ?? { message: 'Request failed.' } : { message: 'Request failed.' } } }; }
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
