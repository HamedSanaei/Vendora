"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type ComponentPropsWithRef } from "react";
import { useSelector } from "react-redux";
import { megaMenuCategories } from "@/lib/vendora/catalog";
import { useBrandCopy, useStoreSettings, storePresentation } from './store-settings-provider';
import { resolveApiImageUrl } from '@/lib/http';
import { formatNumber } from "@/lib/vendora/format";
import type { Locale, MegaMenuCategory } from "@/lib/vendora/types";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { CartIcon, ChevronIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/vendora/icons";
import { MiniCart } from "@/components/vendora/cart/mini-cart";
import { MobileBottomNavigation } from "@/components/vendora/layout/mobile-bottom-navigation";
import { AccountDrawer } from "@/components/vendora/account/account-chrome";
import { HeaderAccountDropdown, HeaderWishlistDropdown } from "./header-dropdowns";
import { useHeaderDropdowns, type HeaderDropdownId } from "./use-header-dropdowns";
import useAuthCheck from "@/hooks/use-auth-check";
import { useAccountLogout } from "@/lib/auth/use-account-logout";

const desktopLinks = [
  { key: "bestSellers", href: "/shop" },
  { key: "officeBags", href: "/shop" },
  { key: "dailyBags", href: "/shop" },
  { key: "travel", href: "/shop" },
  { key: "journal", href: "/about" },
  { key: "trackOrder", href: "/account/orders" },
] as const;

/** Penpot navigation shell for the 1408px desktop and 390px mobile components. */
export function StoreHeader({ initialLocale = "fa" }: { initialLocale?: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale: Locale = getLocaleFromPathname(pathname, initialLocale);
  const [query, setQuery] = useState("");
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dropdowns = useHeaderDropdowns(pathname);
  const authReady = useAuthCheck();
  const auth = useSelector((state: { auth: { accessToken?: string; user?: { name?: string } } }) => state.auth);
  const authenticated = Boolean(auth.accessToken && auth.user);
  const logout = useAccountLogout(locale);
  const profile = useStoreSettings();
  const wishlistQuantity = useSelector((state: { wishlist: { wishlist: unknown[] } }) => state.wishlist.wishlist.length);
  const [activeKey, setActiveKey] = useState(megaMenuCategories[0]?.key ?? "");
  const cartQuantity = useSelector((state: { cart: { cart_products: Array<{ orderQuantity?: number }> } }) => state.cart.cart_products.reduce((total, item) => total + (Number(item.orderQuantity) || 0), 0));
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = useCallback(() => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const closeDropdown = dropdowns.close;
  const openMega = useCallback(() => { cancelClose(); closeDropdown(); setMegaOpen(true); }, [cancelClose, closeDropdown]);
  const closeMegaSoon = useCallback(() => { cancelClose(); closeTimer.current = setTimeout(() => setMegaOpen(false), 220); }, [cancelClose]);
  const closeOverlay = useCallback(() => closeDropdown(true), [closeDropdown]);
  const onNavigate = useCallback(() => closeDropdown(), [closeDropdown]);
  const handleLogout = () => { closeDropdown(); logout(); };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMegaOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); cancelClose(); };
  }, [cancelClose]);

  useEffect(() => {
    if (dropdowns.active) { cancelClose(); setMegaOpen(false); setDrawerOpen(false); }
  }, [dropdowns.active, cancelClose]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    router.push(withLocalePath(value ? `/search?query=${encodeURIComponent(value)}` : "/shop", locale));
    setQuery("");
  };

  const activeCategory = megaMenuCategories.find((category) => category.key === activeKey) ?? megaMenuCategories[0];
  return (
    <header className="relative z-40 bg-white">
      <DesktopHeader locale={locale} query={query} setQuery={setQuery} submitSearch={submitSearch} megaOpen={megaOpen} openMega={openMega} closeMegaSoon={closeMegaSoon} cartQuantity={cartQuantity} wishlistQuantity={wishlistQuantity} dropdowns={dropdowns} />
      <MobileHeader locale={locale} query={query} setQuery={setQuery} submitSearch={submitSearch} openDrawer={() => { closeDropdown(); setDrawerOpen(true); }} expanded={drawerOpen} cartQuantity={cartQuantity} dropdowns={dropdowns} />
      {megaOpen && activeCategory ? <DesktopMegaMenu locale={locale} activeCategory={activeCategory} setActiveKey={setActiveKey} keepOpen={openMega} closeSoon={closeMegaSoon} close={() => setMegaOpen(false)} /> : null}
      {drawerOpen ? <MobileCategoryDrawer locale={locale} close={() => setDrawerOpen(false)} /> : null}
      {dropdowns.desktop && dropdowns.active === "account" ? <HeaderAccountDropdown locale={locale} pathname={pathname} authenticated={authenticated} authReady={authReady} userName={auth.user?.name} brandName={storePresentation(profile, locale).name}
        panelRef={node => { dropdowns.registerPanel("account", node); }} onPointerEnter={dropdowns.cancelClose} onPointerLeave={dropdowns.leave} onBlur={event => dropdowns.blur("account", event)} onNavigate={onNavigate} onLogout={handleLogout} /> : null}
      {dropdowns.desktop && dropdowns.active === "wishlist" ? <HeaderWishlistDropdown locale={locale} panelRef={node => { dropdowns.registerPanel("wishlist", node); }} onPointerEnter={dropdowns.cancelClose} onPointerLeave={dropdowns.leave} onBlur={event => dropdowns.blur("wishlist", event)} onNavigate={onNavigate} /> : null}
      {!dropdowns.desktop && authenticated && dropdowns.active === "account" ? <AccountDrawer locale={locale} pathname={pathname} onClose={closeOverlay} onLogout={handleLogout} headerNavigation panelRef={node => { dropdowns.registerPanel("account", node); }} /> : null}
      <MiniCart open={dropdowns.active === "cart"} locale={locale} onClose={closeOverlay}
        desktopPanelRef={node => { dropdowns.registerPanel("cart", node, "desktop"); }} mobilePanelRef={node => { dropdowns.registerPanel("cart", node, "mobile"); }}
        onDesktopPointerEnter={dropdowns.cancelClose} onDesktopPointerLeave={dropdowns.leave} onDesktopBlur={event => dropdowns.blur("cart", event)} />
      <MobileBottomNavigation locale={locale} pathname={pathname} cartQuantity={cartQuantity} accountExpanded={!dropdowns.desktop && dropdowns.active === "account"} onAccountOpen={authenticated ? element => dropdowns.open("account", element) : undefined} />
    </header>
  );
}

interface SearchProps { locale: Locale; query: string; setQuery: (value: string) => void; submitSearch: (event: FormEvent<HTMLFormElement>) => void; }

/** Exact 1408×132 desktop header component from Penpot. */
function DesktopHeader({ locale, query, setQuery, submitSearch, megaOpen, openMega, closeMegaSoon, cartQuantity, wishlistQuantity, dropdowns }: SearchProps & { megaOpen: boolean; openMega: () => void; closeMegaSoon: () => void; cartQuantity: number; wishlistQuantity: number; dropdowns: ReturnType<typeof useHeaderDropdowns>; }) {
  const t = useBrandCopy(locale);
  /** Adds only interaction semantics to the original 44px header controls. */
  const triggerProps = (id: HeaderDropdownId) => ({
    ref: (node: HTMLButtonElement | null) => { dropdowns.registerTrigger(id, node); },
    "aria-expanded": dropdowns.active === id,
    "aria-controls": id === "cart" ? "vd-header-cart-desktop" : `vd-header-${id}`,
    onPointerEnter: (event: React.PointerEvent<HTMLButtonElement>) => dropdowns.enter(id, event),
    onPointerLeave: dropdowns.leave,
    onFocus: (event: React.FocusEvent<HTMLButtonElement>) => dropdowns.focus(id, event),
    onBlur: (event: React.FocusEvent<HTMLButtonElement>) => dropdowns.blur(id, event),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => dropdowns.keyDown(id, event),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => dropdowns.toggle(id, event.currentTarget),
  });
  return (
    <div className="vd-desktop-header-frame hidden h-[132px] xl:block">
      <div className="relative h-[76px] border-b border-vd-line">
        <BrandLogo locale={locale} className="absolute right-6 top-4 w-[186px] items-center" />
        <form onSubmit={submitSearch} role="search" className="absolute left-[300px] right-[230px] top-4 h-12 min-[1400px]:left-[462px] min-[1400px]:right-auto min-[1400px]:w-[616px]">
          <label htmlFor="vd-desktop-search" className="vd-sr-only">{t.common.searchLabel}</label>
          <div className="flex h-12 items-center rounded-control bg-surface-soft px-4">
            <input id="vd-desktop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.nav.desktopSearchPlaceholder} className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink shadow-none outline-none placeholder:text-vd-muted" />
            <button type="submit" aria-label={t.common.searchLabel} className="vd-focus flex h-10 w-10 items-center justify-center text-vd-muted"><SearchIcon size={18} /></button>
          </div>
        </form>
        <div dir="ltr" className="absolute left-7 top-[18px] flex gap-3">
          <HeaderIconTrigger label={t.common.cart} quantity={cartQuantity} locale={locale} data-header-trigger="cart" {...triggerProps("cart")}><CartIcon size={18} /></HeaderIconTrigger>
          <HeaderIconTrigger label={t.common.account} locale={locale} data-header-trigger="account" {...triggerProps("account")}><UserIcon size={18} /></HeaderIconTrigger>
          <HeaderIconTrigger label={t.common.wishlist} quantity={wishlistQuantity} locale={locale} data-header-trigger="wishlist" {...triggerProps("wishlist")}><HeartIcon size={18} /></HeaderIconTrigger>
        </div>
      </div>
      <nav aria-label="primary" className="relative h-14">
        <ul className="absolute inset-y-0 left-[296px] right-[132px] m-0 flex list-none items-center justify-between p-0">
          <li><button type="button" onMouseEnter={openMega} onMouseLeave={closeMegaSoon} onFocus={openMega} onClick={openMega} aria-expanded={megaOpen} aria-controls="vendora-desktop-mega" className="vd-focus flex h-10 w-[132px] items-center justify-center text-sm font-bold text-jade">{t.nav.categories}</button></li>
          {desktopLinks.map((link) => <li key={link.key}><Link href={withLocalePath(link.href, locale)} className="vd-focus flex h-10 items-center px-2 text-sm font-semibold text-ink hover:text-jade">{t.nav[link.key]}</Link></li>)}
        </ul>
      </nav>
    </div>
  );
}

/** Exact 390×116 mobile header component from Penpot. */
function MobileHeader({ locale, query, setQuery, submitSearch, openDrawer, expanded, cartQuantity, dropdowns }: SearchProps & { openDrawer: () => void; expanded: boolean; cartQuantity: number; dropdowns: ReturnType<typeof useHeaderDropdowns>; }) {
  const t = useBrandCopy(locale);
  return (
    <div className="vd-container h-[116px] xl:hidden">
      <div className="relative h-[68px]">
        <button type="button" onClick={openDrawer} aria-label={t.common.menu} aria-expanded={expanded} className="vd-focus absolute right-3 top-[14px] flex h-10 w-10 items-center justify-center text-ink"><MenuIcon size={20} /></button>
        <BrandLogo locale={locale} className="absolute left-1/2 top-[10px] -translate-x-1/2 items-center" />
        <HeaderIconTrigger label={t.common.cart} locale={locale} quantity={cartQuantity} onClick={event => dropdowns.toggle("cart", event.currentTarget)} aria-expanded={dropdowns.active === "cart"} aria-controls="vd-header-cart-mobile" className="absolute left-0 top-3"><CartIcon size={18} /></HeaderIconTrigger>
      </div>
      <form onSubmit={submitSearch} role="search" className="h-[38px]">
        <label htmlFor="vd-mobile-search" className="vd-sr-only">{t.common.searchLabel}</label>
        <div className="flex h-[38px] items-center rounded-control bg-surface-soft px-3"><SearchIcon size={17} className="shrink-0 text-vd-muted" /><input id="vd-mobile-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.nav.mobileSearchPlaceholder} className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink shadow-none outline-none placeholder:text-vd-muted" /></div>
      </form>
    </div>
  );
}

/** Exact 628×648 desktop menu panel from the Penpot open state. */
function DesktopMegaMenu({ locale, activeCategory, setActiveKey, keepOpen, closeSoon, close }: { locale: Locale; activeCategory: MegaMenuCategory; setActiveKey: (key: string) => void; keepOpen: () => void; closeSoon: () => void; close: () => void; }) {
  const t = useBrandCopy(locale);
  return (
    <div className="absolute inset-x-0 top-[132px] hidden h-[648px] xl:block" onMouseLeave={closeSoon}>
      <button type="button" tabIndex={-1} aria-label={t.common.close} onMouseEnter={close} onClick={close} className="absolute inset-x-4 inset-y-0 bg-ink/[0.72]" />
      <div id="vendora-desktop-mega" className="absolute right-4 top-0 h-[648px] w-[628px] overflow-hidden bg-white" dir={locale === "fa" ? "rtl" : "ltr"} onMouseEnter={keepOpen} onMouseLeave={closeSoon}>
        <div className="absolute left-0 top-0 h-[648px] w-[340px] overflow-hidden bg-surface-soft px-7">
          <h2 className="absolute inset-x-7 top-6 m-0 flex h-[42px] items-center text-[22px] font-bold leading-[1.4] text-ink">{locale === "fa" ? activeCategory.label : activeCategory.labelEn}</h2>
          <Link href={withLocalePath(activeCategory.href, locale)} className="vd-focus absolute inset-x-7 top-[66px] m-0 flex h-[30px] items-center text-[13px] font-semibold text-jade">{t.common.viewAll} {locale === "fa" ? activeCategory.label : activeCategory.labelEn} ←</Link>
          <hr className="absolute inset-x-7 top-[108px] m-0 h-px border-0 bg-vd-line" />
          <div className="absolute inset-x-7 top-32 space-y-[14px]">{activeCategory.groups.map((group) => <section key={group.title}><h3 className="m-0 flex h-[30px] items-center text-[15px] font-bold text-ink">{locale === "fa" ? group.title : group.titleEn}</h3><ul className="m-0 mt-1 list-none p-0">{group.items.map((item) => <li key={item.label} className="m-0"><Link href={withLocalePath(item.href, locale)} className="vd-focus flex h-8 items-center text-[13px] text-vd-muted hover:text-jade">{locale === "fa" ? item.label : item.labelEn}</Link></li>)}</ul></section>)}</div>
        </div>
        <ul className="absolute right-0 top-0 m-0 h-[648px] w-[288px] list-none bg-white p-0 !pb-[16px] !pt-0">
          {megaMenuCategories.map((category) => { const active = category.key === activeCategory.key; return <li key={category.key} className="m-0 h-16"><button type="button" onMouseEnter={() => setActiveKey(category.key)} onFocus={() => setActiveKey(category.key)} onClick={() => setActiveKey(category.key)} aria-current={active ? "page" : undefined} className={`vd-focus relative flex h-14 w-full items-center px-6 text-start text-[15px] ${active ? "bg-jade-tint font-bold text-jade" : "font-normal text-ink hover:bg-surface-soft"}`}><span>{locale === "fa" ? category.label : category.labelEn}</span><ChevronIcon size={18} className={`absolute left-1 top-1/2 -translate-y-1/2 ${active ? "text-jade" : "text-vd-muted"}`} /></button></li>; })}
        </ul>
      </div>
    </div>
  );
}

/** Exact 332px Penpot drawer plus drill-down submenus. */
function MobileCategoryDrawer({ locale, close }: { locale: Locale; close: () => void }) {
  const t = useBrandCopy(locale);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = megaMenuCategories.find((category) => category.key === selectedKey);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [close]);
  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button type="button" aria-label={t.common.close} onClick={close} className="absolute inset-0 bg-ink/[0.72]" />
      <div role="dialog" aria-modal="true" aria-label={t.nav.megaMenuTitle} className={`absolute inset-y-0 ${locale === "fa" ? "right-0" : "left-0"} flex w-[332px] max-w-[85vw] flex-col bg-white`}>
        <div className="flex h-[72px] shrink-0 items-center justify-between px-5"><h2 className="text-xl font-bold text-ink">{selected ? (locale === "fa" ? selected.label : selected.labelEn) : t.nav.megaMenuTitle}</h2><button ref={closeRef} type="button" onClick={close} aria-label={t.common.close} className="vd-focus flex h-10 w-10 items-center justify-center text-ink"><CloseIcon size={22} /></button></div>
        <hr className="mx-5 m-0 border-vd-line" />
        {selected ? <div className="flex-1 overflow-y-auto px-5 py-4"><button type="button" onClick={() => setSelectedKey(null)} className="vd-focus flex h-10 items-center gap-2 text-sm font-bold text-jade"><ChevronIcon size={18} />{t.common.back}</button><Link href={withLocalePath(selected.href, locale)} onClick={close} className="vd-focus mt-2 flex h-12 items-center rounded-control bg-jade-tint px-4 text-sm font-bold text-jade">{t.common.viewAll} {locale === "fa" ? selected.label : selected.labelEn}</Link>{selected.groups.map((group) => <section key={group.title} className="mt-5"><h3 className="text-[15px] font-bold leading-[30px] text-ink">{locale === "fa" ? group.title : group.titleEn}</h3><ul className="m-0 list-none divide-y divide-vd-line p-0">{group.items.map((item) => <li key={item.label}><Link href={withLocalePath(item.href, locale)} onClick={close} className="vd-focus flex h-11 items-center text-sm text-vd-muted hover:text-jade">{locale === "fa" ? item.label : item.labelEn}</Link></li>)}</ul></section>)}</div> : <ul className="m-0 flex-1 list-none overflow-y-auto px-5 py-0">{megaMenuCategories.map((category, index) => <li key={category.key} className={index < megaMenuCategories.length - 1 ? "border-b border-vd-line" : ""}><button type="button" onClick={() => setSelectedKey(category.key)} className={`vd-focus relative flex h-[60px] w-full items-center text-start text-[15px] ${index === 0 ? "font-bold text-jade" : "font-medium text-ink"}`}><span>{locale === "fa" ? category.label : category.labelEn}</span><ChevronIcon size={18} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-vd-muted" /></button></li>)}</ul>}
        {!selected ? <div className="shrink-0 p-5"><Link href={withLocalePath("/shop", locale)} onClick={close} className="vd-focus flex h-12 items-center justify-center rounded-control bg-jade text-sm font-bold text-white">{t.nav.viewAllProducts}</Link></div> : null}
      </div>
    </div>
  );
}

/** Uses the original wordmark until a saved localized name or logo overrides it. */
function BrandLogo({ locale, className = "" }: { locale: Locale; className?: string }) {
  const profile = useStoreSettings();
  const brand = storePresentation(profile, locale);
  return <Link href={withLocalePath("/", locale)} aria-label={brand.name} className={`vd-focus flex flex-col leading-none ${className}`}>
    {profile.logoUrl ? <Image unoptimized width={150} height={30} src={resolveApiImageUrl(profile.logoUrl)} alt={brand.name} className="h-[30px] max-w-[150px] object-contain" /> : <span className="max-w-[180px] truncate text-[26px] font-extrabold tracking-tight text-ink">{brand.wordmark}</span>}
    <span className="mt-1 max-w-[180px] truncate text-xs font-semibold text-jade">{brand.tagline}</span></Link>;
}
/** Original header icon appearance shared by the controls and their live quantity badges. */
function HeaderIconTrigger({ locale, label, quantity = 0, className = "", children, ...props }: ComponentPropsWithRef<"button"> & { locale: Locale; label: string; quantity?: number; children: ReactNode }) {
  return <button type="button" aria-label={label} aria-haspopup="dialog" className={`vd-focus relative flex h-11 w-11 items-center justify-center rounded-full border border-vd-line bg-white text-ink hover:border-jade hover:text-jade ${className}`} {...props}>{children}{quantity > 0 ? <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-jade px-1 text-[11px] font-extrabold text-white">{formatNumber(quantity, locale)}</span> : null}</button>;
}
