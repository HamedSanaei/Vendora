import { apiSlice } from "src/redux/api/apiSlice";
import { userLoggedIn } from "./authSlice";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";

async function accountRequest(path, body, token, method) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
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

function toTemplateUser(account) {
  return {
    _id: account.id,
    id: account.id,
    name: account.fullName,
    email: account.email,
    role: account.role,
    phone: account.phoneNumber,
    bio: account.bio,
  };
}

function persistAuth(account, dispatch) {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      accessToken: account.token,
      user: toTemplateUser(account),
    })
  );

  dispatch(
    userLoggedIn({
      accessToken: account.token,
      user: toTemplateUser(account),
    })
  );
}

export const authApi = apiSlice.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    registerUser: builder.mutation({
      async queryFn(data, _queryApi, _extraOptions, _baseQuery) {
        return accountRequest("/api/account/register", {
          fullName: data.name,
          email: data.email,
          password: data.password,
          phoneNumber: data.phoneNumber,
        });
      },
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          persistAuth(result.data, dispatch);
        } catch {
          // handled by the form
        }
      },
    }),

    loginUser: builder.mutation({
      async queryFn(data) {
        return accountRequest("/api/account/login", data);
      },
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          persistAuth(result.data, dispatch);
        } catch {
          // handled by the form
        }
      },
    }),

    getUser: builder.query({
      async queryFn() {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest("/api/account/me", null, localAuth?.accessToken);
      },
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: toTemplateUser(result.data) }));
        } catch {
          // ignored for guests
        }
      },
    }),

    confirmEmail: builder.query({
      queryFn: async () => ({ data: null }),
    }),

    resetPassword: builder.mutation({
      async queryFn(data) {
        return accountRequest("/api/account/forgot-password", { email: data.verifyEmail ?? data.email });
      },
    }),

    confirmForgotPassword: builder.mutation({
      async queryFn(data) {
        return accountRequest("/api/account/reset-password", {
          email: data.email,
          token: data.token,
          newPassword: data.password ?? data.newPassword,
        });
      },
    }),

    changePassword: builder.mutation({
      queryFn: async () => ({ error: { status: 501, data: { message: "Change password is not available yet." } } }),
    }),

    updateProfile: builder.mutation({
      async queryFn(data, { dispatch }) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        const result = await accountRequest(
          "/api/account/profile",
          {
            fullName: data.name,
            email: data.email,
            phoneNumber: data.phone,
            bio: data.bio,
          },
          localAuth?.accessToken,
          "PUT"
        );

        if (result.data) {
          const user = toTemplateUser(result.data);
          localStorage.setItem(
            "auth",
            JSON.stringify({
              accessToken: localAuth?.accessToken,
              user,
            })
          );
          dispatch(userLoggedIn({ accessToken: localAuth?.accessToken, user }));
        }

        return result;
      },
    }),

    getAddresses: builder.query({
      async queryFn() {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest("/api/account/addresses", null, localAuth?.accessToken);
      },
      providesTags: ["Address"],
    }),

    createAddress: builder.mutation({
      async queryFn(data) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest("/api/account/addresses", data, localAuth?.accessToken);
      },
      invalidatesTags: ["Address"],
    }),

    updateAddress: builder.mutation({
      async queryFn({ id, ...data }) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest(`/api/account/addresses/${id}`, data, localAuth?.accessToken, "PUT");
      },
      invalidatesTags: ["Address"],
    }),

    deleteAddress: builder.mutation({
      async queryFn(id) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest(`/api/account/addresses/${id}`, null, localAuth?.accessToken, "DELETE");
      },
      invalidatesTags: ["Address"],
    }),

    setDefaultAddress: builder.mutation({
      async queryFn(id) {
        const localAuth = JSON.parse(localStorage.getItem("auth") || "{}");
        return accountRequest(`/api/account/addresses/${id}/default`, {}, localAuth?.accessToken, "POST");
      },
      invalidatesTags: ["Address"],
    }),
  }),
});

export const {
  useLoginUserMutation,
  useRegisterUserMutation,
  useConfirmEmailQuery,
  useResetPasswordMutation,
  useConfirmForgotPasswordMutation,
  useChangePasswordMutation,
  useUpdateProfileMutation,
  useGetAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} = authApi;
