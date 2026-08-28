"use client";

import { useState } from "react";
import Link from "next/link";
import { mockOrderDetail, mockOrders } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale, OrderSummary } from "@/lib/vendora/types";
import { formatPrice, localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { OrderStatusBadge, StatusBadge } from "@/components/vendora/ui/status-badge";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { VendoraButton } from "@/components/vendora/ui/button";
import { BagArtwork, type ArtworkColor } from "@/components/vendora/product/bag-artwork";
import {
  CheckIcon,
  ChevronIcon,
  OrdersIcon,
  SearchIcon,
} from "@/components/vendora/icons";

type StatusFilter = "all" | "processing" | "shipped";

/**
 * Order history (Penpot "Order History / Desktop|Mobile"):
 * search + status chips on top, then a desktop table / mobile card list.
 */
export function OrdersListContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const customerName = locale === "fa" ? "کاربر وندورا" : "Vendora user";
  const filtered = mockOrders
    .filter((order) => (filter === "all" ? true : order.status === filter))
    .filter((order) =>
      query.trim() ? localizeDigits(order.code, locale).includes(localizeDigits(query.trim(), locale)) : true,
    );

  return (
    <div className="vd-order-detail space-y-6">
      {/* Filters row */}
      <div className="vd-order-filters flex flex-col gap-4 rounded-card bg-surface-soft p-5 xl:flex-row xl:items-center xl:gap-6 xl:p-6">
        <label className="vd-order-search flex h-14 w-full min-w-0 flex-none items-center gap-3 rounded-control border border-vd-line bg-white px-4 transition-[border-color,box-shadow] focus-within:border-jade focus-within:ring-2 focus-within:ring-jade/10 xl:flex-1">
          <SearchIcon size={18} className="shrink-0 text-vd-muted" />
          <span className="vd-sr-only">{t.account.orders.searchPlaceholder}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.account.orders.searchPlaceholder}
            className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[0.8125rem] text-ink shadow-none outline-none placeholder:text-vd-muted focus:border-0 focus:outline-none focus:ring-0"
          />
        </label>
        <div role="group" aria-label={t.account.orders.title} className="flex flex-wrap gap-2 xl:shrink-0">
          {(["all", "processing", "shipped"] as const).map((key) => {
            const active = filter === key;
            const label =
              key === "all"
                ? t.account.orders.filters.all
                : key === "processing"
                  ? t.account.orders.filters.processing
                  : t.account.orders.filters.shipped;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className={`vd-focus min-h-11 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  active ? "bg-vd-success-tint text-vd-success" : "border border-vd-line bg-white text-jade hover:bg-surface-soft"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<OrdersIcon size={44} />} title={t.account.orders.emptyFiltered} body="" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-card border border-vd-line bg-white md:block">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="bg-surface-soft text-start vd-text-caption text-vd-muted">
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.id}</th>
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.customer}</th>
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.count}</th>
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.status}</th>
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.total}</th>
                  <th scope="col" className="px-5 py-4 text-start font-semibold">{t.account.orders.tableHead.date}</th>
                  <th scope="col" className="px-5 py-4"><span className="vd-sr-only">{t.common.details}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vd-line">
                {filtered.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-surface-soft">
                    <td className="px-5 py-3.5 font-bold text-ink">{localizeDigits(order.code, locale)}</td>
                    <td className="px-5 py-3.5 text-vd-muted">{customerName}</td>
                    <td className="px-5 py-3.5 text-ink">{localizeDigits(String(order.itemCount), locale)}</td>
                    <td className="px-5 py-3.5"><OrderStatusBadge status={order.status} labels={t.account.statusLabels} /></td>
                    <td className="px-5 py-3.5 font-bold text-ink">{formatPrice(order.total, locale)}</td>
                    <td className="px-5 py-3.5 text-vd-muted">{locale === "fa" ? order.dateLabel : order.dateLabelEn}</td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={withLocalePath(`/account/orders/${order.id}`, locale)}
                        aria-label={`${t.common.details}: ${order.code}`}
                        className="vd-focus inline-flex h-9 w-9 items-center justify-center rounded-full border border-vd-line text-jade hover:border-jade"
                      >
                        <ChevronIcon size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-4 md:hidden">
            {filtered.map((order) => (
              <MobileOrderCard key={order.id} order={order} locale={locale} customerName={customerName} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MobileOrderCard({
  order,
  locale,
  customerName,
}: {
  order: OrderSummary;
  locale: Locale;
  customerName: string;
}) {
  const t = getDict(locale);
  return (
    <li>
      <Link
        href={withLocalePath(`/account/orders/${order.id}`, locale)}
        className="vd-focus block rounded-card border border-vd-line bg-white p-4 hover:border-jade"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.9375rem] font-bold text-ink">{localizeDigits(order.code, locale)}</p>
          <ChevronIcon size={16} className="text-vd-muted" />
        </div>
        <p className="vd-text-caption mt-1 text-vd-muted">
          {locale === "fa" ? order.dateLabel : order.dateLabelEn} · {customerName}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <OrderStatusBadge status={order.status} labels={t.account.statusLabels} />
          <p className="text-sm font-bold text-ink">{formatPrice(order.total, locale)}</p>
        </div>
      </Link>
    </li>
  );
}

const artworkCycle: ArtworkColor[] = ["jade", "clay", "steel"];

/**
 * Order detail (Penpot "Order Detail"): progress timeline, summary grid,
 * item list, address/totals pair and action buttons. Data is the mock
 * VD-1048 record; unknown ids still render it as a demo fallback.
 */
export function OrderDetailContent({ orderId, locale }: { orderId: string; locale: Locale }) {
  const t = getDict(locale);
  const d = t.account.orders.detail;
  const order = mockOrderDetail;
  const steps = d.steps;
  void orderId;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <section aria-label={d.summaryTitle} className="vd-order-progress rounded-card border border-vd-line bg-white px-6 py-6">
        <ol className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
          {steps.map((step, index) => {
            const done = index <= order.progressStep;
            return (
              <li key={step} className="relative flex min-w-[86px] flex-1 flex-col items-center text-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={`absolute top-[25px] h-1 w-[calc(100%-52px)] rounded-sm ${
                      index <= order.progressStep ? "bg-jade" : "bg-vd-line"
                    } end-[calc(50%+26px)]`}
                  />
                ) : null}
                <span
                  className={`z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 text-sm font-bold ${
                    done ? "border-jade bg-jade text-white" : "border-vd-line bg-white text-vd-muted"
                  }`}
                >
                  {done ? <CheckIcon size={20} /> : localizeDigits(String(index + 1), locale)}
                </span>
                <span className={`mt-2 whitespace-nowrap text-xs font-semibold ${done ? "text-jade" : "text-vd-muted"}`}>
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Summary */}
      <section className="vd-order-summary rounded-card border border-vd-line bg-white p-6">
        <h2 className="text-[1.1875rem] font-bold text-ink">{d.summaryTitle}</h2>
        <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="vd-text-caption text-vd-muted">{d.statusLabel}</dt>
            <dd><OrderStatusBadge status={order.status} labels={t.account.statusLabels} /></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="vd-text-caption text-vd-muted">{d.paymentLabel}</dt>
            <dd className="text-[0.8125rem] font-bold text-ink">{locale === "fa" ? "پرداخت آنلاین" : "Online gateway"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="vd-text-caption text-vd-muted">{d.shippingLabel}</dt>
            <dd className="text-[0.8125rem] font-bold text-ink">{locale === "fa" ? "پست پیشتاز" : "Express post"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="vd-text-caption text-vd-muted">{d.countLabel}</dt>
            <dd className="text-[0.8125rem] font-bold text-ink">
              {localizeDigits(String(order.itemCount), locale)} {t.account.orders.itemsSuffix}
            </dd>
          </div>
        </dl>
      </section>

      {/* Items */}
      <section className="vd-order-items rounded-card border border-vd-line bg-white p-6">
        <h2 className="text-[1.1875rem] font-bold text-ink">{d.itemsTitle}</h2>
        <ul className="mt-4 divide-y divide-vd-line">
          {order.items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-control bg-surface-soft">
                <BagArtwork color={artworkCycle[index % 3]} className="h-16 w-auto" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold text-ink">{item.name}</p>
                <p className="vd-text-caption mt-1 text-vd-muted">
                  {localizeDigits(String(item.quantity), locale)} {d.qtySuffix}
                </p>
              </div>
              <p className="text-sm font-bold text-ink">{formatPrice(item.price, locale)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Address + totals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-vd-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">{d.addressTitle}</h2>
          <p className="mt-3 text-[0.8125rem] leading-7 text-ink">{order.shippingAddress.address}</p>
          <p className="vd-text-caption mt-3 text-vd-muted">
            {getDict(locale).account.addresses.recipientPrefix} {order.shippingAddress.recipient}
          </p>
        </section>
        <section className="rounded-card border border-vd-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink">{d.totalsTitle}</h2>
          <dl className="mt-4 space-y-4">
            <div className="flex justify-between gap-3">
              <dt className="vd-text-caption text-vd-muted">{d.itemsSubtotal}</dt>
              <dd className="text-[0.8125rem] font-medium text-ink">{formatPrice(order.itemsSubtotal, locale, false)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="vd-text-caption text-vd-muted">{d.shippingCost}</dt>
              <dd className="text-[0.8125rem] font-medium text-ink">
                {order.shippingCost === 0 ? d.freeShipping : formatPrice(order.shippingCost, locale, false)}
              </dd>
            </div>
            <hr className="border-vd-line" />
            <div className="flex justify-between gap-3">
              <dt className="vd-text-caption text-vd-muted">{d.grandTotal}</dt>
              <dd className="text-[0.9375rem] font-bold text-jade">{formatPrice(order.total, locale)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <VendoraButton href={withLocalePath("/account/orders", locale)} variant="outline" size="lg" className="w-full">
          {d.invoice}
        </VendoraButton>
        <VendoraButton href={withLocalePath("/account/returns/new", locale)} variant="primary" size="lg" className="w-full">
          {d.requestReturn}
        </VendoraButton>
        <VendoraButton href={withLocalePath("/contact", locale)} variant="outline" size="lg" className="w-full">
          {d.support}
        </VendoraButton>
      </div>
    </div>
  );
}

/** Small helper used by returns list to render its own status pills. */
export function ReturnToneBadge({ tone, label }: { tone: "warning" | "success" | "danger"; label: string }) {
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
