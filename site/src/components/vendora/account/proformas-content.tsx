"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuthCheck from "@/hooks/use-auth-check";
import { VendoraButton } from "@/components/vendora/ui/button";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { OrdersIcon } from "@/components/vendora/icons";
import { commercialError, commercialPdf, documentCopy, documentToken, myProformas, type CommercialDocuments } from "@/lib/accounting-documents";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { AddressSignInNotice } from "./addresses-content";

/** Implements the Penpot My Proformas desktop/mobile frames inside the existing account scaffold. */
export function ProformasContent({ locale }: { locale: Locale }) {
  const checked = useAuthCheck(), params = useSearchParams(), router = useRouter(), t = documentCopy[locale];
  const page = Math.max(1, Number(params.get("page")) || 1), token = checked ? documentToken() : null;
  const [result, setResult] = useState<{ page: number; data?: CommercialDocuments; error?: string }>({ page: 0 });
  const [revision, setRevision] = useState(0), [pdfError, setPdfError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    myProformas(page, token, controller.signal).then(data => { if (!controller.signal.aborted) setResult({ page, data }); }).catch(error => { if (!controller.signal.aborted) setResult({ page, error: commercialError(error, locale === "fa") }); });
    return () => controller.abort();
  }, [token, page, revision, locale]);
  /** Downloads snapshots repeatedly without changing the saved quote or its monetary values. */
  async function download(id: string, size: "A4" | "A5" = "A4", print = false) {
    if (!token || busy) return; setBusy(true); setPdfError("");
    try { await commercialPdf(id, size, token, print); } catch (error) { setPdfError(commercialError(error, locale === "fa")); } finally { setBusy(false); }
  }
  /** Paginates using the existing locale URL, allowing refresh and back/forward. */
  function changePage(value: number) { const next = new URLSearchParams(params); next.set("page", String(value)); router.push(`${withLocalePath("/account/proformas", locale)}?${next}`); }
  if (!checked) return <p role="status">{t.loading}</p>;
  if (!token) return <AddressSignInNotice locale={locale} returnTo="/account/proformas" />;
  if (result.page !== page) return <p role="status">{t.loading}</p>;
  if (result.error) return <div role="alert" className="rounded-card border border-vd-line p-6"><p className="mb-4 text-vd-danger">{result.error}</p><VendoraButton onClick={() => setRevision(x => x + 1)}>{t.retry}</VendoraButton></div>;
  const data = result.data;
  if (!data?.items.length) return <EmptyState icon={<OrdersIcon size={44} />} title={t.empty} body={t.emptyBody} action={<VendoraButton href={withLocalePath("/cart", locale)}>{t.cart}</VendoraButton>} />;
  return <div className="space-y-6">
    <section className="flex flex-wrap items-center justify-between gap-5 rounded-card border border-vd-line bg-jade-tint p-6"><div><h2 className="text-sm font-bold text-jade">{t.count}</h2><p className="mt-3 text-2xl font-extrabold">{formatNumber(data.total, locale)}</p><p className="mt-4 text-xs leading-7 text-vd-muted">{t.disclaimer}</p></div><VendoraButton disabled={busy} onClick={() => download(data.items[0].id)}>{busy ? t.loading : t.latest}</VendoraButton></section>
    {pdfError && <p role="alert" className="rounded-card bg-vd-danger-tint p-5 text-sm leading-7 text-vd-danger">{pdfError}</p>}
    <div className="rounded-card border border-vd-line bg-surface-soft p-5 text-sm font-bold">{t.all}</div>
    <div className="hidden grid-cols-[1fr_2fr_1fr] rounded-control bg-ink px-6 py-5 text-sm font-bold text-white lg:grid"><span>{t.date}</span><span>{t.number}</span><span>{t.amount}</span></div>
    <div className="space-y-3">{data.items.map(doc => <article key={doc.id} className="grid gap-4 rounded-card border border-vd-line bg-white p-5 lg:grid-cols-[1fr_2fr_1fr] lg:items-center">
      <p className="text-sm text-vd-muted">{new Date(doc.issuedAtUtc).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB")}</p><div><p className="font-bold"><bdi>{doc.number}</bdi></p><p className="mt-1 text-xs text-vd-muted">{doc.lines.map(x => x.title).join(locale === "fa" ? "، " : ", ")}</p><div className="mt-3 flex flex-wrap gap-2"><VendoraButton size="lg" variant="outline" disabled={busy} onClick={() => download(doc.id, "A4")}>PDF A4</VendoraButton><VendoraButton size="lg" variant="outline" disabled={busy} onClick={() => download(doc.id, "A5")}>PDF A5</VendoraButton><VendoraButton size="lg" variant="ghost" disabled={busy} onClick={() => download(doc.id, "A4", true)}>{t.print}</VendoraButton></div></div><strong className="text-sm">{formatPrice(doc.totalToman, locale)}</strong>
    </article>)}</div>
    <nav className="flex justify-center gap-4" aria-label={t.all}><VendoraButton variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>{t.previous}</VendoraButton><span className="self-center">{formatNumber(page, locale)}</span><VendoraButton variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => changePage(page + 1)}>{t.next}</VendoraButton></nav>
    <aside className="rounded-card border border-vd-line bg-vd-info-tint p-6"><h2 className="font-bold">{t.rules}</h2><p className="mt-4 text-sm leading-8">{t.disclaimer}</p></aside>
  </div>;
}
