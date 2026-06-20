"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!user) {
      router.replace(withLocalePath("/login", locale));
    }
  }, [locale, router, user]);

  if (!user) {
    return null;
  }

  return children;
}
