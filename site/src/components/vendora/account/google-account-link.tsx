"use client";

import { useState } from "react";
import axios from "axios";
import { GoogleIdentityButton } from "@/components/vendora/auth/google-identity-button";
import { http } from "@/lib/http";
import type { Locale } from "@/lib/vendora/types";

/** Existing password accounts can link Google only after authenticating normally. */
export function GoogleAccountLink({ locale }: { locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()) return null;

  const connect = async (credential: string) => {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      if (!auth?.accessToken) throw new Error("Not signed in");
      await http.post("/account/google/link", { credential }, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      setSuccess(true);
    } catch (failure) {
      const message = axios.isAxiosError(failure) ? failure.response?.data?.message : "";
      setError(message === "The Google email must match your account email."
        ? (locale === "fa" ? "ایمیل حساب Google باید با ایمیل حساب شما یکسان باشد." : "Google email must match your account email.")
        : (locale === "fa" ? "اتصال Google انجام نشد. دوباره تلاش کنید." : "Google could not be linked. Please retry."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-panel border border-vd-line bg-white p-6">
      <h2 className="text-lg font-bold text-ink">{locale === "fa" ? "اتصال حساب Google" : "Connect Google account"}</h2>
      <p className="mt-2 text-sm leading-7 text-vd-muted">
        {locale === "fa" ? "با اتصال حساب Google، دفعات بعد می‌توانید بدون رمز عبور وارد شوید." : "Link Google to sign in without a password next time."}
      </p>
      <GoogleIdentityButton locale={locale} onCredential={connect} />
      {busy && <p role="status" className="mt-2 text-sm">{locale === "fa" ? "در حال اتصال…" : "Connecting…"}</p>}
      {success && <p role="status" className="mt-2 text-sm text-jade">{locale === "fa" ? "حساب Google متصل شد." : "Google account linked."}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-vd-danger">{error}</p>}
    </section>
  );
}
