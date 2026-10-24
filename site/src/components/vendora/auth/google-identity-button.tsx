"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Locale } from "@/lib/vendora/types";

type CredentialReply = { credential?: string };
type GoogleIdentityApi = {
  initialize(options: { client_id: string; callback: (response: CredentialReply) => void; auto_select: boolean; ux_mode: "popup" }): void;
  renderButton(element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; width: number; text: "continue_with"; locale: string }): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

/** Official Google Identity Services button; credential is sent only to Vendora's API. */
export function GoogleIdentityButton({
  locale,
  onCredential,
}: {
  locale: Locale;
  onCredential: (credential: string) => Promise<void>;
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const credentialHandler = useRef(onCredential);
  useEffect(() => { credentialHandler.current = onCredential; }, [onCredential]);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId || !scriptReady || !holder.current || !window.google?.accounts?.id) return;
    const api = window.google.accounts.id;
    const target = holder.current;
    target.replaceChildren();
    api.initialize({
      client_id: clientId,
      auto_select: false,
      ux_mode: "popup",
      callback: response => {
        if (response.credential) void credentialHandler.current(response.credential);
      },
    });
    let renderedWidth = 0;
    // Measure before CSS zoom: the official iframe is enlarged uniformly,
    // including personalized account text, without overriding Google's font.
    const render = () => {
      const width = Math.min(400, Math.floor(target.clientWidth));
      if (width <= 0 || width === renderedWidth) return;
      renderedWidth = width;
      target.replaceChildren();
      api.renderButton(target, {
        type: "standard",
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        locale,
      });
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(target);
    return () => { observer.disconnect(); target.replaceChildren(); };
  }, [clientId, locale, scriptReady]);

  if (!clientId) return null;

  return (
    <div className="mt-5 flex w-full flex-col items-center gap-2">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
        onReady={() => setScriptReady(true)} onError={() => setScriptFailed(true)} />
      <div ref={holder} className="vd-google-identity-button" aria-label={locale === "fa" ? "ورود با Google" : "Sign in with Google"} />
      {scriptFailed ? <p role="alert" className="font-sans text-base leading-7 text-vd-danger">
        {locale === "fa" ? "بارگذاری سرویس Google انجام نشد." : "Google sign-in could not be loaded."}
      </p> : null}
    </div>
  );
}
