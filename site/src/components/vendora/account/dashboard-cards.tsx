"use client";

import Link from "next/link";
import { mockOrders, mockProfile } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { formatNumber, formatPrice, localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { VendoraButton } from "@/components/vendora/ui/button";
import { OrderStatusBadge } from "@/components/vendora/ui/status-badge";
import {
  HeartIcon,
  OrdersIcon,
  PinIcon,
  QuickPayIcon,
  StarIcon,
  SupportIcon,
} from "@/components/vendora/icons";

const quickIcons = [OrdersIcon, PinIcon, HeartIcon, QuickPayIcon];
const quickHrefs = ["/account/orders", "/account/addresses", "/account/wishlist", "/account/quick-pay"];

/** Greeting card with avatar, intro copy, member badge and profile link. */
export function ProfileSummaryCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  return (
    <section className="relative min-h-[220px] rounded-panel border border-vd-line bg-white p-[20px] lg:h-[214px] lg:min-h-0 lg:border-0 lg:p-[32px] lg:shadow-card">
      <div className="flex items-start gap-4 lg:items-center lg:gap-5">
        <span
          aria-hidden
          className="flex h-[84px] w-[84px] shrink-0 -translate-x-[8px] items-center justify-center rounded-full bg-jade-tint text-[2rem] font-bold text-jade lg:h-24 lg:w-24 lg:translate-x-0 lg:text-[2.125rem]"
        >
          V
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="whitespace-nowrap text-[18px] font-bold leading-8 text-ink lg:text-[1.375rem] lg:leading-10">{t.account.dashboard.greeting}</h2>
            <span className="hidden rounded-full bg-vd-success-tint px-2 py-0.5 text-xs font-semibold text-vd-success lg:inline-flex">
              {locale === "fa" ? mockProfile.memberBadge : mockProfile.memberBadgeEn}
            </span>
          </div>
          <p className="mt-1 text-sm leading-7 text-vd-muted lg:hidden">{locale === "fa" ? "مدیریت سفارش‌ها و اطلاعات حساب" : "Manage orders and account details"}</p>
          <span className="absolute start-[28px] top-[126px] inline-flex h-7 w-[140px] items-center justify-center rounded-full bg-vd-success-tint text-xs font-semibold text-vd-success lg:hidden">
            {formatNumber(mockProfile.clubPoints, locale)} {t.account.dashboard.clubPointsSuffix}
          </span>
          <p className="mt-1 hidden max-w-lg text-sm leading-7 text-vd-muted lg:block">{t.account.dashboard.intro}</p>
          <Link
            href={withLocalePath("/account/profile", locale)}
            className="vd-focus absolute bottom-3 left-[22px] right-[28px] flex h-12 items-center justify-center rounded-control border border-jade text-sm font-bold text-jade hover:text-jade-dark lg:static lg:mt-2 lg:inline-flex lg:h-auto lg:border-0"
          >
            {t.account.dashboard.editProfileLink} ←
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Dark jade loyalty card with points and progress bar. */
export function ClubCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const progress = Math.round((mockProfile.clubPoints / (mockProfile.clubPoints + mockProfile.clubPointsToNext)) * 100);
  return (
    <section aria-label={t.account.dashboard.clubTitle} className="relative hidden h-[214px] overflow-hidden rounded-card bg-jade-dark p-[24px] lg:block">
      <StarIcon size={34} className="absolute end-6 top-6 text-jade-glow" />
      <p className="text-lg font-bold text-white">{t.account.dashboard.clubTitle}</p>
      <p className="mt-2 text-[1.625rem] font-bold text-white">
        {formatNumber(mockProfile.clubPoints, locale)} {t.account.dashboard.clubPointsSuffix}
      </p>
      <p className="vd-text-caption mt-1 text-on-dark-soft">
        {t.account.dashboard.clubToNext(formatNumber(mockProfile.clubPointsToNext, locale))}
      </p>
      <div className="mt-4 h-2 w-full rounded-sm bg-white/25">
        <div className="h-2 rounded-sm bg-jade-glow" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

/** Three quick-access tiles linking into account sections. */
export function QuickActionsSection({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  return (
    <section aria-label={t.account.dashboard.quickTitle} className="!mt-[36px] lg:!mt-[48px]">
      <h2 className="vd-text-section-title text-ink">{t.account.dashboard.quickTitle}</h2>
      <div className="mt-[16px] grid grid-cols-2 gap-x-[12px] gap-y-[20px] lg:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-[20px]">
        {t.account.dashboard.quickCards.map((card, index) => {
          const Icon = quickIcons[index];
          return (
            <Link
              key={card.title}
              href={withLocalePath(quickHrefs[index], locale)}
              className={`vd-focus group relative h-[154px] rounded-card bg-surface-soft px-[20px] py-[28px] transition-colors hover:bg-jade-tint lg:p-[24px] ${index === 3 ? "lg:hidden" : ""}`}
            >
              <span className="absolute end-[20px] top-[28px] flex h-6 w-6 items-center justify-center text-2xl font-semibold text-jade lg:end-[24px] lg:top-[28px] lg:h-6 lg:w-6">
                {Icon ? <Icon size={24} /> : null}
              </span>
              <p className="pe-8 text-[1.0625rem] font-bold text-ink">{card.title}</p>
              <p className="mt-0.5 hidden text-[0.8125rem] text-vd-muted lg:block">{card.body}</p>
              <span className="absolute bottom-[22px] start-[20px] inline-flex text-[0.8125rem] font-bold text-jade group-hover:text-jade-dark lg:start-[24px]">
                {card.cta} ←
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Latest orders list card used on the account overview. */
export function RecentOrdersCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const recent = mockOrders.slice(0, 3);
  return (
    <section aria-label={t.account.dashboard.recentOrders} className="!mt-[60px] lg:!mt-[48px]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="vd-text-section-title text-ink">{t.account.dashboard.recentOrders}</h2>
        <Link
          href={withLocalePath("/account/orders", locale)}
          className="vd-focus hidden rounded-control text-[0.8125rem] font-semibold text-jade hover:text-jade-dark lg:block"
        >
          {t.account.dashboard.recentOrdersAll} ←
        </Link>
      </div>
      <div className="mt-[16px] space-y-3 lg:h-[404px] lg:divide-y lg:divide-vd-line lg:space-y-0 lg:rounded-card lg:border lg:border-vd-line lg:bg-white lg:px-[20px] lg:py-[4px]">
        {recent.map((order) => (
          <div key={order.id} className="vd-order-row grid min-h-[220px] grid-cols-2 items-center gap-x-[16px] rounded-card border border-vd-line bg-white p-[20px] lg:h-[116px] lg:min-h-0 lg:grid-cols-[minmax(0,1.35fr)_156px_minmax(0,0.8fr)_minmax(0,1fr)_100px] lg:gap-x-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            <p className="vd-order-title order-2 min-w-0 whitespace-nowrap text-[0.9375rem] font-bold text-ink lg:truncate lg:text-center">
              {locale === "fa" ? "سفارش " : "Order "}
              {localizeDigits(order.code, locale)}
            </p>
            <OrderStatusBadge status={order.status} labels={t.account.statusLabels} className="vd-order-status order-1 justify-center" />
            <p className="vd-order-date vd-text-caption order-3 min-w-0 whitespace-nowrap text-vd-muted before:me-2 before:content-['تاریخ'] lg:truncate lg:text-center lg:before:content-none">
              {locale === "fa" ? order.dateLabel : order.dateLabelEn}
            </p>
            <p className="vd-order-amount order-4 min-w-0 whitespace-nowrap text-sm font-bold text-ink before:me-2 before:font-normal before:text-vd-muted before:content-['مبلغ'] lg:truncate lg:text-center lg:before:content-none">{formatPrice(order.total, locale)}</p>
            <VendoraButton href={withLocalePath(`/account/orders/${order.id}`, locale)} variant="outline" size="md" className="vd-order-button order-5 col-span-2 h-12 w-full border-[1px]! border-jade! bg-white! text-jade! before:content-['مشاهده_'] lg:col-span-1 lg:w-[100px] lg:before:content-none">
              {t.common.details}
            </VendoraButton>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Support call-out band at the bottom of the overview. */
export function SupportNoticeCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  return (
    <section className="relative min-h-[132px] rounded-card bg-jade-tint p-[24px] lg:!mt-[26px] lg:flex lg:h-[124px] lg:min-h-0 lg:flex-row lg:items-center lg:gap-[16px]">
      <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-control bg-white text-jade lg:flex">
        <SupportIcon size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[1.0625rem] font-bold text-ink">{t.account.dashboard.supportTitle}</p>
        <p className="vd-text-caption mt-1 text-vd-muted">{t.account.dashboard.supportBody}</p>
      </div>
      <VendoraButton href={withLocalePath("/contact", locale)} variant="outline" size="lg" className="absolute inset-x-[24px] bottom-[6px] h-[38px] shrink-0 lg:static lg:h-auto">
        {t.account.dashboard.supportCta}
      </VendoraButton>
    </section>
  );
}

/** Small labelled value row used inside summary grids. */
export function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="vd-text-caption text-vd-muted">{label}</dt>
      <dd className="text-[0.8125rem] font-bold text-ink">{value}</dd>
    </div>
  );
}

/** Reusable section card shell matching the white radius-16 panels. */
export function CardPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-vd-line bg-white p-6 ${className ?? ""}`}>
      {title ? <h2 className="mb-4 text-[1.1875rem] font-bold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}
