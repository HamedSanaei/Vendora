"use client";

import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import useAuthCheck from "@/hooks/use-auth-check";
import { LoginCard } from "@/components/vendora/auth/login-card";
import type { Locale } from "@/lib/vendora/types";

type AccountAuthState = {
  auth: {
    accessToken?: string;
    user?: unknown;
  };
};

/** The account shell must not present mock profile data to anonymous visitors. */
export function AccountAuthGate({ children, locale }: { children: ReactNode; locale: Locale }) {
  const authChecked = useAuthCheck();
  const { accessToken, user } = useSelector((state: AccountAuthState) => state.auth);

  if (!authChecked) {
    return <div role="status" aria-live="polite" className="min-h-[60vh] bg-surface-soft" />;
  }

  if (!accessToken || !user) {
    return <LoginCard locale={locale} />;
  }

  return <>{children}</>;
}
