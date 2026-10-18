import { apiSlice } from "src/redux/api/apiSlice";
import { sync_cart_prices } from "./cartSlice";

export const authApi = apiSlice.injectEndpoints({
  overrideExisting:true,
  endpoints: (builder) => ({
    // get showing products
    getShowingProducts: builder.query({
      query: () => `api/products/show`,
      providesTags: ["Products"],
      keepUnusedDataFor: 600,
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sync_cart_prices(data.products));
        } catch {
          // Preserve the last known cart prices when the internal catalog is unreachable.
        }
      },
    }),
    // get discount products
    getDiscountProducts: builder.query({
      query: () => `api/products/discount`,
      providesTags: ["Discount"],
      keepUnusedDataFor: 600,
    }),
    // get single product
    getProduct: builder.query({
      query: (id) => `api/products/${id}`,
      providesTags: (result, error, arg) => [{ type: "Product", id: arg }],
      invalidatesTags: (result, error, arg) => [
        { type: "RelatedProducts", id: arg },
      ],
    }),
    // getRelatedProducts
    getRelatedProducts: builder.query({
      query: ({ id, tags }) => {
        const queryString = 
        `api/products/relatedProduct?tags=${tags.join(",")}`;
        return queryString;
      },
      providesTags: (result, error, arg) => [
        { type: "RelatedProducts", id: arg.id },
      ],
      invalidatesTags: (result, error, arg) => [
        { type: "Product", id: arg.id },
      ],
    }),
  }),
});

export const {
  useGetShowingProductsQuery,
  useGetDiscountProductsQuery,
  useGetProductQuery,
  useGetRelatedProductsQuery,
} = authApi;
