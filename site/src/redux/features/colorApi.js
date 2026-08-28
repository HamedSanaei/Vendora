import { apiSlice } from "src/redux/api/apiSlice";

export const colorApi = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getColors: builder.query({
      query: () => "api/catalog/colors",
      providesTags: ["Colors"],
      keepUnusedDataFor: 600,
    }),
  }),
});

export const { useGetColorsQuery } = colorApi;
