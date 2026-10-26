"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import useAuthCheck from "@/hooks/use-auth-check";
import { VendoraButton } from "@/components/vendora/ui/button";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { OrdersIcon } from "@/components/vendora/icons";
import { commercialFailure, commercialPdf, documentCopy, myProformas, type CommercialDocuments, type CommercialFailure } from "@/lib/accounting-documents";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { AddressSignInNotice } from "./addresses-content";

/** Implements the Penpot My Proformas desktop/mobile frames inside the existing account scaffold. */
export function ProformasContent({ locale }: { locale: Locale }) {
  const checked = useAuthCheck(), params = useSearchParams(), router = useRouter(), t = documentCopy[locale];
  const accessToken = useSelector((state: { auth: { accessToken?: string } }) => state.auth.accessToken);
  const page = Math.max(1, Number(params.get("page")) || 1), token = checked ? accessToken : undefined;
  const [result, setResult] = useState<{ key: string; data?: CommercialDocuments; failure?: CommercialFailure }>({ key: "" });
  const [revision, setRevision] = useState(0), [pdfError, setPdfError] = useState<{ token: string; failure: CommercialFailure } | null>(null), [busy, setBusy] = useState(false);
  const requestKey = `${locale}:${page}:${revision}:${token ?? ""}`;
  const returnTo = withLocalePath("/account/proformas", locale);
  const loginHref = `${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(returnTo)}`;
  useEffect(() => {
    if (!token) return;
    const credential = token;
    const controller = new AbortController();
    /** Scopes both successful rows and failures to this credential/page so old responses cannot replace a new session. */
    async function load() {
      try {
        const data = await myProformas(page, credential, controller.signal);
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      } catch (error) {
        if (controller.signal.aborted) return;
        try {
          const failure = await commercialFailure(error, credential, locale === "fa", controller.signal);
          if (!controller.signal.aborted) setResult({ key: requestKey, failure });
        } catch {
          if (!controller.signal.aborted) setResult({ key: requestKey, failure: { message: documentCopy[locale].verificationFailed, signInRequired: false } });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [token, page, requestKey, locale]);
  /** Downloads snapshots repeatedly without changing the saved quote or its monetary values. */
  async function download(id: string, size: "A4" | "A5" = "A4", print = false) {
    if (!token || busy) return; setBusy(true); setPdfError(null);
    try { await commercialPdf(id, size, token, print); } catch (error) { setPdfError({ token, failure: await commercialFailure(error, token, locale === "fa") }); } finally { setBusy(false); }
  }
  /** Paginates using the existing locale URL, allowing refresh and back/forward. */
  function changePage(value: number) { const next = new URLSearchParams(params); next.set("page", String(value)); router.push(`${withLocalePath("/account/proformas", locale)}?${next}`); }
  if (!checked) return <p role="status">{t.loading}</p>;
  if (!token) return <AddressSignInNotice locale={locale} returnTo="/account/proformas" />;
  if (result.key !== requestKey) return <p role="status">{t.loading}</p>;
  if (result.failure) return <DocumentFailureNotice failure={result.failure} locale={locale} loginHref={loginHref} onRetry={() => setRevision(x => x + 1)} />;
  const data = result.data;
  if (!data?.items.length) return <EmptyState icon={<OrdersIcon size={44} />} title={t.empty} body={t.emptyBody} action={<VendoraButton href={withLocalePath("/cart", locale)}>{t.cart}</VendoraButton>} />;
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-card border border-vd-line bg-jade-tint p-6"><div><h2 className="text-sm font-bold text-jade">{t.count}</h2><p className="mt-3 text-2xl font-extrabold">{formatNumber(data.total, locale)}</p><p className="mt-4 text-xs leading-7 text-vd-muted">{t.disclaimer}</p></div><VendoraButton disabled={busy} onClick={() => download(data.items[0].id)}>{busy ? t.loading : t.latest}</VendoraButton></section>
    {pdfError?.token === token && <DocumentFailureNotice failure={pdfError.failure} locale={locale} loginHref={loginHref} />}
    <div className="rounded-card border border-vd-line bg-surface-soft p-5 text-sm font-bold">{t.all}</div>
    <div className="hidden grid-cols-[1fr_2fr_1fr] rounded-control bg-ink px-6 py-5 text-sm font-bold text-white lg:grid"><span>{t.date}</span><span>{t.number}</span><span>{t.amount}</span></div>
    <div className="space-y-3">{data.items.map(doc => <article key={doc.id} className="grid gap-4 rounded-card border border-vd-line bg-white p-5 lg:grid-cols-[1fr_2fr_1fr] lg:items-center">
      <p className="text-sm text-vd-muted">{new Date(doc.issuedAtUtc).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB")}</p><div><p className="font-bold"><bdi>{doc.number}</bdi></p><p className="mt-1 text-xs text-vd-muted">{doc.lines.map(x => x.title).join(locale === "fa" ? "، " : ", ")}</p><div className="mt-3 flex flex-wrap gap-2"><VendoraButton size="lg" variant="outline" disabled={busy} onClick={() => download(doc.id, "A4")}>PDF A4</VendoraButton><VendoraButton size="lg" variant="outline" disabled={busy} onClick={() => download(doc.id, "A5")}>PDF A5</VendoraButton><VendoraButton size="lg" variant="ghost" disabled={busy} onClick={() => download(doc.id, "A4", true)}>{t.print}</VendoraButton></div></div><strong className="text-sm">{formatPrice(doc.totalToman, locale)}</strong>
    </article>)}</div>
    <nav className="flex justify-center gap-4" aria-label={t.all}><VendoraButton variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>{t.previous}</VendoraButton><span className="self-center">{formatNumber(page, locale)}</span><VendoraButton variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => changePage(page + 1)}>{t.next}</VendoraButton></nav>
    <aside className="rounded-card border border-vd-line bg-vd-info-tint p-6"><h2 className="font-bold">{t.rules}</h2><p className="mt-4 text-sm leading-8">{t.disclaimer}</p></aside>
  </div>;
}

/** Reuses existing feedback/buttons without treating every document failure as a logout or expired JWT. */
function DocumentFailureNotice({ failure, locale, loginHref, onRetry }: { failure: CommercialFailure; locale: Locale; loginHref: string; onRetry?: () => void }) {
  const t = documentCopy[locale];
  return <div role="alert" className="rounded-card border border-vd-line p-6">
    <p className="mb-4 text-vd-danger">{failure.message}</p>
    <div className="flex flex-wrap gap-3">
      {failure.signInRequired && <VendoraButton href={loginHref}>{t.signIn}</VendoraButton>}
      {onRetry && <VendoraButton variant={failure.signInRequired ? "outline" : "primary"} onClick={onRetry}>{t.retry}</VendoraButton>}
    </div>
  </div>;
}
