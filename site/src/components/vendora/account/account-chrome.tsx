"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { useAccountLogout } from "@/lib/auth/use-account-logout";
import {
  accountNavItems,
  isAccountItemActive,
} from "@/lib/vendora/account-nav";
import { getDict } from "@/lib/vendora/i18n";
import { mockProfile } from "@/lib/vendora/account-data";
import { useSeedDataEnabled } from "../layout/store-settings-provider";
import type { Locale } from "@/lib/vendora/types";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { Breadcrumb, type Crumb } from "@/components/vendora/ui/page-header";
import {
  ChevronIcon,
  CloseIcon,
  HeartIcon,
  HomeIcon,
  IdCardIcon,
  LockIcon,
  MenuIcon,
  OrdersIcon,
  PinIcon,
  QuickPayIcon,
  ReturnIcon,
  WalletIcon,
  type VendoraIconProps,
} from "@/components/vendora/icons";

/** Existing account icons shared by the sidebar, drawer and header summary. */
export const accountMenuIcons: Record<string, (props: VendoraIconProps) => ReactNode> = {
  overview: HomeIcon,
  profile: IdCardIcon,
  security: LockIcon,
  addresses: PinIcon,
  orders: OrdersIcon,
  returns: ReturnIcon,
  transactions: WalletIcon,
  wishlist: HeartIcon,
  quickPay: QuickPayIcon,
  proformas: OrdersIcon,
};

/**
 * Account page frame (Penpot account layout):
 * breadcrumb row on top, then a two-column grid — content plus the 300px
 * sidebar card. Below `lg` the sidebar becomes the mobile nav bar + drawer.
 */
export function AccountPageFrame({ crumbs, children, initialLocale }: { crumbs: Crumb[]; children: ReactNode; initialLocale: Locale }) {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname, initialLocale);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    /** Releases the mobile drawer/body lock when resizing into the desktop sidebar layout. */
    const closeOnDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  const logout = useAccountLogout(locale);
  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
  };
  const t = getDict(locale);
  const activeItem = accountNavItems.find((item) => isAccountItemActive(item.href, pathname));
  const activeLabel = activeItem ? t.account.menu[activeItem.key as keyof typeof t.account.menu] : "";

  return (
    <div className="vd-account-page min-h-[calc(100vh-116px)] bg-white pb-8 lg:min-h-[calc(100vh-133px)] lg:pb-16">
      {/* Mobile account navigation bar --------------------------------- */}
      <div className="sticky top-0 z-30 flex h-[72px] items-center border-b border-vd-line bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t.common.menu}
          aria-expanded={drawerOpen}
          className="vd-focus -ms-2 flex h-[42px] w-[42px] items-center justify-center rounded-full text-ink hover:bg-surface-soft"
        >
          <MenuIcon size={20} />
        </button>
        <p className="mx-auto text-lg font-bold text-ink">{pathname.replace(/^\/(fa|en)/, "") === "/account" ? t.common.account : activeLabel || t.common.account}</p>
        <button
          type="button"
          onClick={() => history.back()}
          aria-label={t.common.back}
          className="vd-focus -me-2 flex h-[42px] w-[42px] items-center justify-center rounded-full text-vd-muted hover:bg-surface-soft"
        >
          <ChevronIcon size={22} className="rotate-180 rtl:rotate-0" />
        </button>
      </div>

      <div className="vd-container pt-[18px] lg:pt-8">
        <div className="hidden lg:block"><Breadcrumb items={crumbs} /></div>
        <div className="flex flex-col gap-8 lg:mt-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Content column */}
          <div className="order-2 min-w-0 flex-1 lg:order-1">{children}</div>
          {/* Sidebar column */}
          <aside className="order-1 hidden w-[300px] shrink-0 lg:order-2 lg:block" aria-label={t.common.account}>
            <SidebarCard locale={locale} pathname={pathname} onLogout={handleLogout} />
          </aside>
        </div>
      </div>

      {drawerOpen ? (
        <AccountDrawer
          locale={locale}
          pathname={pathname}
          onClose={() => setDrawerOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}
    </div>
  );
}

/** Local open/close state with body scroll-lock handled by the drawer. */

/**
 * Desktop sidebar card: avatar block, membership meta, nine menu items and
 * the danger logout action at the bottom.
 */
function SidebarCard({ locale, pathname, onLogout }: { locale: Locale; pathname: string; onLogout: () => void }) {
  const t = getDict(locale);
  const showSamples = useSeedDataEnabled();
  const displayName = useSelector((state: { auth: { user?: { name?: string } } }) => state.auth.user?.name);
  return (
    <div className="vd-account-sidebar min-h-[700px] rounded-panel border border-vd-line bg-white p-[24px]">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className="flex h-[108px] w-[108px] items-center justify-center rounded-full bg-jade-tint text-[2.375rem] font-bold text-jade"
        >
          V
        </span>
        <p className="mt-3 text-lg font-bold leading-8 text-ink">
          {displayName || (locale === "fa" ? mockProfile.fullName : mockProfile.fullNameEn)}
        </p>
        {showSamples && <p className="vd-text-caption text-vd-muted">{t.account.memberSince}</p>}
      </div>
      <hr className="my-[20px] border-vd-line" />
      <nav aria-label={t.common.account} className="vd-account-navigation">
        <ul className="space-y-1">
          {accountNavItems.map((item) => {
            const Icon = accountMenuIcons[item.key];
            const active = isAccountItemActive(item.href, pathname);
            return (
              <li key={item.key}>
                <Link
                  href={withLocalePath(item.href, locale)}
                  aria-current={active ? "page" : undefined}
                  className={`vd-focus flex min-h-[44px] items-center gap-3 rounded-control px-4 py-2 text-sm transition-colors ${
                    active ? "bg-jade-tint font-bold text-jade" : "text-ink hover:bg-surface-soft hover:text-jade"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center ${active ? "text-jade" : "text-vd-muted"}`}>
                    {Icon ? <Icon size={18} /> : null}
                  </span>
                  {t.account.menu[item.key as keyof typeof t.account.menu]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <hr className="my-[16px] border-vd-line" />
      <button
        type="button"
        title={t.account.menu.logout}
        onClick={onLogout}
        className="vd-focus flex min-h-[44px] w-full items-center gap-3 rounded-control px-4 py-2 text-sm font-semibold text-vd-danger hover:bg-vd-danger-tint"
      >
        <span className="flex h-8 w-8 items-center justify-center">
          <ReturnIcon size={18} className="rtl:-scale-x-100" />
        </span>
        {t.account.menu.logout}
      </button>
    </div>
  );
}

/** Mobile account drawer mirroring the Penpot "Account Drawer / Mobile". */
export function AccountDrawer({
  locale,
  pathname,
  onClose,
  onLogout,
  headerNavigation = false,
  panelRef,
  children,
}: {
  locale: Locale;
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
  headerNavigation?: boolean;
  panelRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  const t = getDict(locale);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasHeaderContent = headerNavigation && Boolean(children);

  useEffect(() => {
    if (hasHeaderContent) contentRef.current?.querySelector<HTMLElement>("[data-mobile-initial-focus]")?.focus({ preventScroll: true });
    else closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, hasHeaderContent]);

  useEffect(() => {
    if (!hasHeaderContent) return;
    const content = contentRef.current;
    const header = content?.closest("header");
    const background = Array.from(document.querySelectorAll<HTMLElement>("main,footer")).filter(node => !header?.contains(node));
    const previous = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    /** Keeps the summary below the existing header, including when opened after scrolling. */
    const fit = () => content?.style.setProperty("--vd-mobile-panel-top", `${Math.max(0, header?.getBoundingClientRect().bottom ?? 116)}px`);
    fit(); window.addEventListener("resize", fit); window.addEventListener("scroll", fit);
    return () => { background.forEach((node, index) => { node.inert = previous[index]; }); window.removeEventListener("resize", fit); window.removeEventListener("scroll", fit); };
  }, [hasHeaderContent]);

  // The new mobile handoff uses the existing drawer lifecycle in the space
  // between the original header and bottom navigation, rather than another page.
  if (headerNavigation && children) return <div ref={contentRef} className="vd-header-mobile-surface xl:hidden">{children}</div>;

  return (
    <div className={`fixed inset-0 z-50 ${headerNavigation ? "xl:hidden" : "lg:hidden"}`}>
      <div className="absolute inset-0 bg-ink/[0.72]" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        id={headerNavigation ? "vd-header-account-mobile" : undefined}
        data-header-dropdown={headerNavigation ? "account" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={t.common.account}
        className="absolute inset-y-0 start-0 flex w-[332px] max-w-[85vw] flex-col bg-white shadow-pop"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-xl font-bold leading-10 text-ink">{t.common.account}</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="vd-focus flex h-[42px] w-[42px] items-center justify-center rounded-full text-ink hover:bg-surface-soft"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <hr className="mx-4 mt-2 border-vd-line" />
        <nav aria-label={t.common.account} className="vd-account-navigation min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {accountNavItems.map((item) => {
              const Icon = accountMenuIcons[item.key];
              const active = isAccountItemActive(item.href, pathname);
              return (
                <li key={item.key}>
                  <Link
                    href={withLocalePath(item.href, locale)}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`vd-focus flex h-[46px] items-center gap-3 rounded-control px-4 text-sm ${
                      active ? "bg-jade-tint font-bold text-jade" : "text-ink hover:bg-surface-soft"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center ${active ? "text-jade" : "text-vd-muted"}`}>
                      {Icon ? <Icon size={17} /> : null}
                    </span>
                    {t.account.menu[item.key as keyof typeof t.account.menu]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-vd-line p-4">
          <button
            type="button"
            onClick={onLogout}
            className="vd-focus flex min-h-[44px] w-full items-center gap-3 rounded-control px-4 py-2 text-sm font-semibold text-vd-danger hover:bg-vd-danger-tint"
          >
            {t.account.menu.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
