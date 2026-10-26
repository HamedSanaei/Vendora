"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type Ref, type PointerEventHandler, type FocusEventHandler } from "react";
import { useDispatch, useSelector } from "react-redux";
import { accountNavItems, isAccountItemActive } from "@/lib/vendora/account-nav";
import { accountMenuIcons } from "@/components/vendora/account/account-chrome";
import { CartProductMedia } from "@/components/vendora/cart/cart-components";
import { getCartUnitPrice } from "@/components/vendora/cart/cart-model";
import { type StoreProduct } from "@/components/vendora/catalog/catalog-types";
import { VendoraButton } from "@/components/vendora/ui/button";
import { CartIcon, ShoppingCartIcon, ChevronIcon, DocumentIcon, ShieldCheckIcon, HeartIcon, LogoutIcon, UserIcon, CheckIcon, ReturnIcon, OrdersIcon } from "@/components/vendora/icons";
import { withLocalePath } from "@/lib/locale-path";
import { formatNumber, formatPrice, localizeDigits } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import { getHeaderDropdownCopy } from "@/lib/vendora/header-dropdown-copy";
import type { Locale } from "@/lib/vendora/types";
import { useGetShowingProductsQuery } from "@/redux/features/productApi";
import { add_cart_product, quantityIncrement } from "@/redux/features/cartSlice";
import { remove_wishlist_product } from "@/redux/features/wishlist-slice";
import { useGetUserOrdersQuery } from "@/redux/features/orderApi";
import { readCustomerAccount, type CustomerAccount } from "@/lib/auth/customer-profile";
import { profileReturnTo } from "@/lib/auth/customer-profile";

interface SurfaceProps {
  locale: Locale;
  panelRef: Ref<HTMLElement>;
  onPointerEnter: PointerEventHandler<HTMLElement>;
  onPointerLeave: PointerEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
  onNavigate: () => void;
  mobile?: boolean;
  onBack?: () => void;
}

const accountKeys = ["overview", "orders", "addresses", "wishlist", "returns", "transactions", "proformas", "tickets", "security"];
const accountItems = accountKeys.flatMap(key => accountNavItems.filter(item => item.key === key));

/** The two approved account states, backed by the existing navigation model and logout workflow. */
export function HeaderAccountDropdown({ locale, panelRef, onPointerEnter, onPointerLeave, onBlur, onNavigate, userName, authenticated, authReady, brandName, pathname, onLogout, mobile = false, onBack, onOpenWishlist, userId }: SurfaceProps & {
  userId?: string; onOpenWishlist?: () => void; userName?: string; authenticated: boolean; authReady: boolean; brandName: string; pathname: string; onLogout: () => void;
}) {
  const copy = getHeaderDropdownCopy(locale);
  const t = getDict(locale);
  const search = useSearchParams();
  const displayedItems = mobile ? ["wishlist", "addresses", "proformas", "tickets", "transactions", "returns", "security"].flatMap(key => accountItems.filter(item => item.key === key)) : accountItems;
  const labels: Record<string, string> = { overview: copy.overview, orders: copy.orders, addresses: copy.addresses, security: copy.security };
  // LoginCard already validates locale-local return paths and directs incomplete profiles to completion.
  const requestedReturn = /^\/(fa|en)\/(login|register|forgot)(\/|$)/.test(pathname) ? search.get("returnTo") : pathname;
  const destination = profileReturnTo(requestedReturn, locale);
  const loginHref = `${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(destination)}`;
  return (
    <section id={mobile ? "vd-header-account-mobile" : "vd-header-account"} ref={panelRef} role="dialog" aria-label={t.common.account} dir={locale === "fa" ? "rtl" : "ltr"}
      data-header-dropdown="account" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}
      className={mobile ? "vd-header-mobile-content vd-header-mobile-account" : "vd-header-popover w-[380px]"}>
      {!authReady ? <p role="status" className="p-6 text-sm text-vd-muted">{copy.loading}</p> : authenticated ? <>
        {mobile ? <MobileAccountSummary locale={locale} userId={userId} userName={userName} onNavigate={onNavigate} /> : <Link href={withLocalePath("/account", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link mx-[22px] flex min-h-[93px] items-start gap-[16px] border-b border-vd-line pb-[16px] pt-[18px]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><UserIcon size={24} /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-[19px] font-bold leading-8 text-ink">{userName || t.common.account}</strong><span className="block text-xs leading-[26px] text-vd-muted">{copy.accountSubtitle}</span></span>
        </Link>}
        <nav aria-label={t.common.account} className="px-[14px] pt-[12px]">
          <ul>
            {displayedItems.map(item => {
              const Icon = item.key === "overview" ? UserIcon : item.key === "orders" ? CartIcon : item.key === "proformas" ? DocumentIcon : item.key === "security" ? ShieldCheckIcon : accountMenuIcons[item.key];
              const active = isAccountItemActive(item.href, pathname);
              const label = labels[item.key] ?? t.account.menu[item.key as keyof typeof t.account.menu];
              return <li key={item.key} className="vd-header-account-row">
                <Link href={withLocalePath(item.href, locale)} onClick={event => { if (mobile && item.key === "wishlist" && onOpenWishlist) { event.preventDefault(); onOpenWishlist(); } else onNavigate(); }} aria-current={active ? "page" : undefined}
                  className={`vd-focus vd-header-text-link flex h-[49px] items-center gap-[16px] rounded-[10px] px-[10px] text-sm ${active ? "bg-[var(--vd-header-soft)] font-bold text-jade" : "font-medium text-ink hover:bg-[var(--vd-header-soft)] hover:text-jade"}`}>
                  <Icon size={24} className="shrink-0 text-vd-muted" /><span className="flex-1">{label}</span>
                </Link>
              </li>;
            })}
          </ul>
        </nav>
        <div className="mx-[22px] !mt-[12px] border-t border-vd-line py-[10px]">
          <button type="button" onClick={onLogout} className="vd-focus flex min-h-11 w-full items-center gap-[16px] rounded-control px-1 text-sm font-semibold text-vd-danger hover:bg-vd-danger-tint"><LogoutIcon size={24} className="ltr:-scale-x-100" />{copy.logout}</button>
        </div>
      </> : <div className={mobile ? "vd-header-mobile-guest" : "px-6 pb-[17px] pt-[22px]"}>
        {mobile && <div className="vd-header-mobile-heading"><h2>{t.common.account}</h2><button type="button" onClick={onBack} aria-label={t.common.close} data-mobile-initial-focus className="vd-focus"><ChevronIcon size={24} className="ltr:rotate-180" /></button><p>{copy.mobileSignInSubtitle}</p></div>}
        <div className={mobile ? "vd-header-mobile-intro" : undefined}>
        <div className="flex items-start gap-[16px]"><span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><UserIcon size={24} /></span><h2 className="min-w-0 flex-1 text-lg font-bold leading-[34px] text-ink">{copy.welcome(brandName)}</h2></div>
        <p className="!mt-[6px] min-h-[53px] text-[13px] leading-[26px] text-vd-muted">{mobile ? copy.mobileIntroduction : copy.introduction}</p>
        <VendoraButton href={loginHref} onClick={onNavigate} className="mt-[23px] !flex !h-[54px] w-full !justify-between !px-5 !text-base !font-bold"><span className="flex-1">{copy.signIn}</span></VendoraButton>
        </div>
        <div className="mt-[18px] divide-y divide-vd-line border-t border-vd-line">
          <Link href={withLocalePath("/cart", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link flex h-[59px] w-full items-center gap-[16px] text-sm font-medium text-ink"><ShoppingCartIcon size={24} className="text-vd-muted" /><span className="flex-1 text-start">{mobile ? copy.mobileCart : copy.viewCart}</span></Link>
          {mobile && <Link href={`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(withLocalePath("/account/orders", locale))}`} onClick={onNavigate} className="vd-focus vd-header-text-link flex min-h-[62px] items-center gap-[16px] text-[15px]"><OrdersIcon size={24} className="text-vd-muted" /><span className="flex-1">{copy.trackOrder}</span></Link>}
          <Link href={withLocalePath("/faq", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link flex h-[59px] items-center gap-[16px] text-sm font-medium text-ink"><DocumentIcon size={24} className="text-vd-muted" /><span className="flex-1">{copy.guide}</span></Link>
        </div>
      </div>}
    </section>
  );
}

interface WishlistState {
  wishlist: { wishlist: StoreProduct[]; hydrated: boolean };
  cart: { cart_products: Array<StoreProduct & { orderQuantity: number }> };
}

/** Compact Penpot wishlist states; uses the existing cached catalog, wishlist actions and cart listener. */
export function HeaderWishlistDropdown({ locale, panelRef, onPointerEnter, onPointerLeave, onBlur, onNavigate, mobile = false, onBack }: SurfaceProps) {
  const copy = getHeaderDropdownCopy(locale), t = getDict(locale);
  const dispatch = useDispatch();
  const { wishlist, hydrated } = useSelector((state: WishlistState) => state.wishlist);
  const cart = useSelector((state: WishlistState) => state.cart.cart_products);
  const { data, isError, isLoading, isFetching, refetch } = useGetShowingProductsQuery(undefined);
  const pending = isLoading || (!data && isFetching);
  const currentProducts = useMemo(() => new Map<string, StoreProduct>((data?.products ?? []).map((item: StoreProduct) => [item._id, item])), [data]);
  const empty = hydrated && wishlist.length === 0;
  return <section id={mobile ? "vd-header-wishlist-mobile" : "vd-header-wishlist"} ref={panelRef} role="dialog" aria-label={copy.wishlistTitle} dir={locale === "fa" ? "rtl" : "ltr"}
    data-header-dropdown="wishlist" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}
    className={mobile ? `vd-header-mobile-content vd-header-mobile-wishlist ${empty ? "is-empty" : ""}` : `vd-header-popover ${empty ? "w-[400px]" : "w-[440px]"}`}>
    <header className="vd-header-wishlist-heading mx-6 flex h-[79px] items-start gap-[16px] border-b border-vd-line pt-[17px]">{mobile ? null : <HeartIcon size={24} className="!mt-[6px] shrink-0 text-jade" />}<h2 className="flex-1 text-[19px] font-bold leading-10 text-ink">{mobile ? copy.mobileWishlistTitle : copy.wishlistTitle}</h2>{mobile && <button type="button" onClick={onBack} aria-label={t.common.back} data-mobile-initial-focus className="vd-focus flex h-11 w-11 shrink-0 items-center justify-center text-vd-muted"><ChevronIcon size={24} className="ltr:rotate-180" /></button>}{!empty && !mobile && <span className="pt-[7px] text-xs font-medium text-vd-muted">{copy.count(formatNumber(wishlist.length, locale))}</span>}</header>
    {mobile && !empty && <p className="vd-header-mobile-count">{copy.savedCount(formatNumber(wishlist.length, locale))}</p>}
    {!hydrated ? <p role="status" className="p-6 text-sm text-vd-muted">{copy.loading}</p> : empty ? <div className="vd-header-wishlist-empty px-6 pb-[13px] pt-[18px] text-center">
      <span className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><HeartIcon size={28} /></span>
      <h3 className="!mt-[12px] text-[15px] font-bold leading-9 text-ink">{copy.emptyTitle}</h3><p className="!-mt-px text-xs leading-[35px] text-vd-muted">{mobile ? copy.mobileEmptyBody : copy.emptyBody}</p>
      <VendoraButton href={withLocalePath("/shop", locale)} onClick={onNavigate} className="mt-[21px] !flex !h-11 w-full !font-bold">{copy.browse}</VendoraButton>{mobile && <p className="vd-header-mobile-empty-footer">{copy.mobileEmptyFooter}</p>}
    </div> : <>
      {isError && <div role="alert" className="mx-6 !mt-[12px] text-xs leading-6 text-vd-danger">{copy.error} <button type="button" onClick={() => void refetch()} className="vd-focus rounded-sm font-bold underline">{copy.retry}</button></div>}
      <div className="vd-header-wishlist-lines max-h-[303px] overflow-y-auto px-[22px]" aria-busy={pending}>
        {wishlist.map(saved => {
          const current = currentProducts.get(saved._id);
          const source = current ?? saved;
          const cartItem = cart.find(item => item._id === saved._id);
          const available = !isError && Boolean(current) && !pending;
          const stock = Number(current?.quantity) || 0;
          const atMaximum = Boolean(cartItem && cartItem.orderQuantity >= stock);
          const disabled = !available || stock <= 0 || atMaximum;
          const detailsHref = withLocalePath(`/product/${encodeURIComponent(source.slug || source._id)}`, locale);
          return <article key={saved._id} className="relative min-h-[147px] border-b border-vd-line py-[10px] first:pt-[19px]">
            <div className="flex gap-[14px]">
              <Link href={detailsHref} onClick={onNavigate} className="vd-focus vd-header-wishlist-media shrink-0 rounded-control"><CartProductMedia item={{ ...source, orderQuantity: cartItem?.orderQuantity ?? 0 }} locale={locale} compact /></Link>
              <div className="vd-header-wishlist-details min-w-0 flex-1 pe-8">
                <Link href={detailsHref} onClick={onNavigate} className="vd-focus vd-header-wishlist-title vd-header-text-link line-clamp-1 text-sm font-bold leading-[30px] text-ink">{source.title}</Link>
                <p className="truncate text-[11px] leading-[25px] text-vd-muted">{source.category?.name || source.parent || source.brand?.name || t.cart.variantFallback}</p>
                <p className="!mt-[5px] text-sm font-bold leading-[30px] text-jade-dark">{pending ? copy.loading : available ? formatPrice(getCartUnitPrice({ ...source, orderQuantity: 1 }), locale) : copy.unavailable}</p>
                <button type="button" disabled={disabled} title={atMaximum ? t.cart.maxStock : undefined}
                  onClick={() => dispatch(cartItem ? quantityIncrement(source) : add_cart_product(source))}
                  className="vd-focus vd-header-wishlist-add mt-[8px] flex h-7 min-w-[130px] items-center justify-center gap-2 rounded-[9px] bg-[var(--vd-header-tint)] px-2 text-[11px] font-semibold text-jade disabled:cursor-not-allowed disabled:opacity-60">
                  <ShoppingCartIcon size={mobile ? 24 : 20} />{available && stock <= 0 ? copy.outOfStock : atMaximum ? t.cart.inCart : mobile ? copy.mobileAdd : copy.add}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => dispatch(remove_wishlist_product(saved))} aria-label={copy.remove(source.title)} className="vd-focus absolute end-[-6px] top-[12px] flex h-10 w-10 items-center justify-center rounded-full text-vd-danger hover:bg-vd-danger-tint"><HeartIcon size={24} /></button>
          </article>;
        })}
      </div>
      <footer className="vd-header-wishlist-footer px-[22px] pb-[42px] pt-[13px]"><p className="px-[10px] text-xs leading-[27px] text-vd-muted">{copy.helper}</p><VendoraButton variant={mobile ? "ghost" : "primary"} href={withLocalePath("/account/wishlist", locale)} onClick={onNavigate} className="mt-8 !flex !h-[62px] w-full !justify-between !px-5 !text-base !font-bold"><span className="flex-1">{mobile ? copy.mobileViewWishlist : copy.viewWishlist}</span><ChevronIcon size={24} className="ltr:rotate-180" /></VendoraButton></footer>
    </>}
  </section>;
}


/** Server-owned identity and order counts for the compact account state; never substitutes sample orders. */
function MobileAccountSummary({ locale, userId, userName, onNavigate }: { locale: Locale; userId?: string; userName?: string; onNavigate: () => void }) {
  const copy = getHeaderDropdownCopy(locale), t = getDict(locale);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Partition the existing query cache by identity; the endpoint remains /Orders/me.
  const { currentData, isFetching, isError, refetch } = useGetUserOrdersQuery(userId, { refetchOnMountOrArgChange: true });
  useEffect(() => {
    const controller = new AbortController();
    setAccount(null); setProfileFailed(false);
    readCustomerAccount(controller.signal).then(value => { if (!controller.signal.aborted) setAccount(value); })
      .catch(() => { if (!controller.signal.aborted) setProfileFailed(true); });
    return () => controller.abort();
  }, [userId, attempt]);
  const orders: Array<{ status: string }> | undefined = currentData?.orders;
  const groups = [
    { label: copy.inProgress, Icon: ShoppingCartIcon, count: orders?.filter(order => ["pendingpayment", "paid", "processing", "packed", "shipped"].includes(order.status)).length, href: "/account/orders" },
    { label: t.account.statusLabels.delivered, Icon: CheckIcon, count: orders?.filter(order => order.status === "delivered").length, href: "/account/orders" },
    { label: copy.mobileReturned, Icon: ReturnIcon, count: orders?.filter(order => order.status === "refunded").length, href: "/account/returns" },
  ];
  const phone = account?.phoneNumber;
  const maskedPhone = phone ? `${phone.slice(0, 4)}•••${phone.slice(-4)}` : "";
  return <>
    <div className="vd-header-mobile-profile">
      <span aria-hidden className="vd-header-mobile-avatar"><UserIcon size={24} /></span>
      <div className="min-w-0"><strong>{account?.fullName || userName || t.common.account}</strong><p dir="ltr">{maskedPhone ? localizeDigits(maskedPhone, locale) : account?.email || ""}</p></div>
      <Link href={withLocalePath("/account/profile", locale)} onClick={onNavigate} data-mobile-initial-focus className="vd-focus vd-header-mobile-edit">{copy.editProfile}</Link>
      <Link href={withLocalePath("/account", locale)} onClick={onNavigate} className="vd-focus vd-header-mobile-member"><span>{t.nav.mobileAccount}</span></Link>
    </div>
    {profileFailed && <p role="alert" className="text-xs text-vd-danger">{copy.profileError} <button type="button" onClick={() => setAttempt(value => value + 1)} className="vd-focus min-h-11 px-2 underline">{copy.retry}</button></p>}
    <div className="vd-header-mobile-orders-heading"><h2>{copy.orders}<OrdersIcon size={24} className="text-jade" /></h2><Link href={withLocalePath("/account/orders", locale)} onClick={onNavigate} className="vd-focus">{t.common.viewAll}</Link></div>
    {isError && <p role="alert" className="text-xs text-vd-danger">{copy.ordersError} <button type="button" onClick={() => void refetch()} className="vd-focus min-h-11 px-2 underline">{copy.retry}</button></p>}
    <div className="vd-header-mobile-order-tiles" aria-busy={isFetching}>
      {groups.map(({ label, Icon, count, href }) => <Link key={href + label} href={withLocalePath(href, locale)} onClick={onNavigate} className="vd-focus"><Icon size={24} /><span>{count === undefined || isError ? "—" : formatNumber(count, locale)}</span><strong>{label}</strong></Link>)}
    </div>
  </>;
}
