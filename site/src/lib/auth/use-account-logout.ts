"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { apiSlice } from "@/redux/api/apiSlice";
import { userLoggedOut } from "@/redux/features/auth/authSlice";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";

/** Shares the existing logout/cache reset across account navigation surfaces; preserves the cart. */
export function useAccountLogout(locale: Locale) {
  const dispatch = useDispatch();
  const router = useRouter();
  return useCallback(() => {
    dispatch(userLoggedOut());
    dispatch(apiSlice.util.resetApiState());
    router.replace(withLocalePath("/login", locale));
  }, [dispatch, locale, router]);
}
