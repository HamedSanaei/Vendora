"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { getLocaleFromPathname } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { CheckoutFlowLayout } from "@/components/vendora/checkout/checkout-shell";
import { LoginCard } from "./login-card";

/** Login route shell that preserves a safe checkout return path. */
export function VendoraLoginPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale: Locale = getLocaleFromPathname(pathname);
  return <CheckoutFlowLayout locale={locale}><LoginCard locale={locale} returnTo={searchParams.get("returnTo") ?? undefined} /></CheckoutFlowLayout>;
}
