"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, type Ref, type PointerEventHandler, type FocusEventHandler } from "react";
import { useDispatch, useSelector } from "react-redux";
import { accountNavItems, isAccountItemActive } from "@/lib/vendora/account-nav";
import { accountMenuIcons } from "@/components/vendora/account/account-chrome";
import { CartProductMedia } from "@/components/vendora/cart/cart-components";
import { getCartUnitPrice } from "@/components/vendora/cart/cart-model";
import { type StoreProduct } from "@/components/vendora/catalog/catalog-types";
import { VendoraButton } from "@/components/vendora/ui/button";
import { CartIcon, ShoppingCartIcon, ChevronIcon, DocumentIcon, ShieldCheckIcon, HeartIcon, LogoutIcon, UserIcon } from "@/components/vendora/icons";
import { withLocalePath } from "@/lib/locale-path";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import { getHeaderDropdownCopy } from "@/lib/vendora/header-dropdown-copy";
import type { Locale } from "@/lib/vendora/types";
import { useGetShowingProductsQuery } from "@/redux/features/productApi";
import { add_cart_product, quantityIncrement } from "@/redux/features/cartSlice";
import { remove_wishlist_product } from "@/redux/features/wishlist-slice";
import { profileReturnTo } from "@/lib/auth/customer-profile";

interface SurfaceProps {
  locale: Locale;
  panelRef: Ref<HTMLElement>;
  onPointerEnter: PointerEventHandler<HTMLElement>;
  onPointerLeave: PointerEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
  onNavigate: () => void;
}

const accountKeys = ["overview", "orders", "addresses", "wishlist", "returns", "transactions", "proformas", "security"];
const accountItems = accountKeys.flatMap(key => accountNavItems.filter(item => item.key === key));

/** The two approved account states, backed by the existing navigation model and logout workflow. */
export function HeaderAccountDropdown({ locale, panelRef, onPointerEnter, onPointerLeave, onBlur, onNavigate, userName, authenticated, authReady, brandName, pathname, onLogout }: SurfaceProps & {
  userName?: string; authenticated: boolean; authReady: boolean; brandName: string; pathname: string; onLogout: () => void;
}) {
  const copy = getHeaderDropdownCopy(locale);
  const t = getDict(locale);
  const search = useSearchParams();
  const labels: Record<string, string> = { overview: copy.overview, orders: copy.orders, addresses: copy.addresses, security: copy.security };
  // LoginCard already validates locale-local return paths and directs incomplete profiles to completion.
  const requestedReturn = /^\/(fa|en)\/(login|register|forgot)(\/|$)/.test(pathname) ? search.get("returnTo") : pathname;
  const destination = profileReturnTo(requestedReturn, locale);
  const loginHref = `${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(destination)}`;
  return (
    <section id="vd-header-account" ref={panelRef} role="dialog" aria-label={t.common.account} dir={locale === "fa" ? "rtl" : "ltr"}
      data-header-dropdown="account" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}
      className="vd-header-popover w-[380px]">
      {!authReady ? <p role="status" className="p-6 text-sm text-vd-muted">{copy.loading}</p> : authenticated ? <>
        <Link href={withLocalePath("/account", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link mx-[22px] flex min-h-[93px] items-start gap-[16px] border-b border-vd-line pb-[16px] pt-[18px]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><UserIcon size={24} /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-[19px] font-bold leading-8 text-ink">{userName || t.common.account}</strong><span className="block text-xs leading-[26px] text-vd-muted">{copy.accountSubtitle}</span></span>
          <ChevronIcon size={24} className="mt-4 shrink-0 text-vd-muted ltr:rotate-180" />
        </Link>
        <nav aria-label={t.common.account} className="px-[14px] pt-[12px]">
          <ul>
            {accountItems.map(item => {
              const Icon = item.key === "overview" ? UserIcon : item.key === "orders" ? CartIcon : item.key === "proformas" ? DocumentIcon : item.key === "security" ? ShieldCheckIcon : accountMenuIcons[item.key];
              const active = isAccountItemActive(item.href, pathname);
              const label = labels[item.key] ?? t.account.menu[item.key as keyof typeof t.account.menu];
              return <li key={item.key} className="vd-header-account-row">
                <Link href={withLocalePath(item.href, locale)} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={`vd-focus vd-header-text-link flex h-[49px] items-center gap-[16px] rounded-[10px] px-[10px] text-sm ${active ? "bg-[var(--vd-header-soft)] font-bold text-jade" : "font-medium text-ink hover:bg-[var(--vd-header-soft)] hover:text-jade"}`}>
                  <Icon size={24} className="shrink-0 text-vd-muted" /><span className="flex-1">{label}</span><ChevronIcon size={24} className="shrink-0 text-vd-muted ltr:rotate-180" />
                </Link>
              </li>;
            })}
          </ul>
        </nav>
        <div className="mx-[22px] !mt-[12px] border-t border-vd-line py-[10px]">
          <button type="button" onClick={onLogout} className="vd-focus flex min-h-11 w-full items-center gap-[16px] rounded-control px-1 text-sm font-semibold text-vd-danger hover:bg-vd-danger-tint"><LogoutIcon size={24} className="ltr:-scale-x-100" />{copy.logout}</button>
        </div>
      </> : <div className="px-6 pb-[17px] pt-[22px]">
        <div className="flex items-start gap-[16px]"><span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><UserIcon size={24} /></span><h2 className="min-w-0 flex-1 text-lg font-bold leading-[34px] text-ink">{copy.welcome(brandName)}</h2></div>
        <p className="!mt-[6px] min-h-[53px] text-[13px] leading-[26px] text-vd-muted">{copy.introduction}</p>
        <VendoraButton href={loginHref} onClick={onNavigate} className="mt-[23px] !flex !h-[54px] w-full !justify-between !px-5 !text-base !font-bold"><span className="flex-1">{copy.signIn}</span><ChevronIcon size={24} className="ltr:rotate-180" /></VendoraButton>
        <div className="mt-[18px] divide-y divide-vd-line border-t border-vd-line">
          <Link href={withLocalePath("/cart", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link flex h-[59px] w-full items-center gap-[16px] text-sm font-medium text-ink"><ShoppingCartIcon size={24} className="text-vd-muted" /><span className="flex-1 text-start">{copy.viewCart}</span><ChevronIcon size={24} className="text-vd-muted ltr:rotate-180" /></Link>
          <Link href={withLocalePath("/faq", locale)} onClick={onNavigate} className="vd-focus vd-header-text-link flex h-[59px] items-center gap-[16px] text-sm font-medium text-ink"><DocumentIcon size={24} className="text-vd-muted" /><span className="flex-1">{copy.guide}</span><ChevronIcon size={24} className="text-vd-muted ltr:rotate-180" /></Link>
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
export function HeaderWishlistDropdown({ locale, panelRef, onPointerEnter, onPointerLeave, onBlur, onNavigate }: SurfaceProps) {
  const copy = getHeaderDropdownCopy(locale), t = getDict(locale);
  const dispatch = useDispatch();
  const { wishlist, hydrated } = useSelector((state: WishlistState) => state.wishlist);
  const cart = useSelector((state: WishlistState) => state.cart.cart_products);
  const { data, isError, isLoading, isFetching, refetch } = useGetShowingProductsQuery(undefined);
  const pending = isLoading || (!data && isFetching);
  const currentProducts = useMemo(() => new Map<string, StoreProduct>((data?.products ?? []).map((item: StoreProduct) => [item._id, item])), [data]);
  const empty = hydrated && wishlist.length === 0;
  return <section id="vd-header-wishlist" ref={panelRef} role="dialog" aria-label={copy.wishlistTitle} dir={locale === "fa" ? "rtl" : "ltr"}
    data-header-dropdown="wishlist" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}
    className={`vd-header-popover ${empty ? "w-[400px]" : "w-[440px]"}`}>
    <header className="mx-6 flex h-[79px] items-start gap-[16px] border-b border-vd-line pt-[17px]"><HeartIcon size={24} className="!mt-[6px] shrink-0 text-jade" /><h2 className="flex-1 text-[19px] font-bold leading-10 text-ink">{copy.wishlistTitle}</h2>{!empty && <span className="pt-[7px] text-xs font-medium text-vd-muted">{copy.count(formatNumber(wishlist.length, locale))}</span>}</header>
    {!hydrated ? <p role="status" className="p-6 text-sm text-vd-muted">{copy.loading}</p> : empty ? <div className="px-6 pb-[13px] pt-[18px] text-center">
      <span className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full bg-[var(--vd-header-tint)] text-jade"><HeartIcon size={28} /></span>
      <h3 className="!mt-[12px] text-[15px] font-bold leading-9 text-ink">{copy.emptyTitle}</h3><p className="!-mt-px text-xs leading-[35px] text-vd-muted">{copy.emptyBody}</p>
      <VendoraButton href={withLocalePath("/shop", locale)} onClick={onNavigate} className="mt-[21px] !flex !h-11 w-full !font-bold">{copy.browse}</VendoraButton>
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
              <div className="min-w-0 flex-1 pe-8">
                <Link href={detailsHref} onClick={onNavigate} className="vd-focus vd-header-text-link line-clamp-1 text-sm font-bold leading-[30px] text-ink">{source.title}</Link>
                <p className="truncate text-[11px] leading-[25px] text-vd-muted">{source.category?.name || source.parent || source.brand?.name || t.cart.variantFallback}</p>
                <p className="!mt-[5px] text-sm font-bold leading-[30px] text-jade-dark">{pending ? copy.loading : available ? formatPrice(getCartUnitPrice({ ...source, orderQuantity: 1 }), locale) : copy.unavailable}</p>
                <button type="button" disabled={disabled} title={atMaximum ? t.cart.maxStock : undefined}
                  onClick={() => dispatch(cartItem ? quantityIncrement(source) : add_cart_product(source))}
                  className="vd-focus mt-[8px] flex h-7 min-w-[130px] items-center justify-center gap-2 rounded-[9px] bg-[var(--vd-header-tint)] px-2 text-[11px] font-semibold text-jade disabled:cursor-not-allowed disabled:opacity-60">
                  <ShoppingCartIcon size={20} />{available && stock <= 0 ? copy.outOfStock : atMaximum ? t.cart.inCart : copy.add}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => dispatch(remove_wishlist_product(saved))} aria-label={copy.remove(source.title)} className="vd-focus absolute end-[-6px] top-[12px] flex h-10 w-10 items-center justify-center rounded-full text-vd-danger hover:bg-vd-danger-tint"><HeartIcon size={24} /></button>
          </article>;
        })}
      </div>
      <footer className="px-[22px] pb-[42px] pt-[13px]"><p className="px-[10px] text-xs leading-[27px] text-vd-muted">{copy.helper}</p><VendoraButton href={withLocalePath("/account/wishlist", locale)} onClick={onNavigate} className="mt-8 !flex !h-[62px] w-full !justify-between !px-5 !text-base !font-bold"><span className="flex-1">{copy.viewWishlist}</span><ChevronIcon size={24} className="ltr:rotate-180" /></VendoraButton></footer>
    </>}
  </section>;
}
