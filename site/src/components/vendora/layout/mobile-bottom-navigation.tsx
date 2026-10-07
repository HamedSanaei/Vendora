"use client";

import Link from "next/link";
import { CategoriesIcon, HomeIcon, ShoppingCartIcon, UserIcon } from "@/components/vendora/icons";
import { formatNumber } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale } from "@/lib/vendora/types";
import { withLocalePath } from "@/lib/locale-path";

type MobileNavigationDestination = "home" | "categories" | "cart" | "account";

interface MobileBottomNavigationProps {
  locale: Locale;
  pathname: string;
  cartQuantity: number;
}

const hiddenRoutes = new Set(["checkout", "shipping", "login", "register", "forgot"]);

/** Resolves the current storefront route to one stable mobile-navigation state. */
function resolveDestination(pathname: string): MobileNavigationDestination | null {
  const localizedRoute = pathname.replace(/^\/(fa|en)(?=\/|$)/, "") || "/";
  const firstSegment = localizedRoute.split("/").filter(Boolean)[0] ?? "";

  if (hiddenRoutes.has(firstSegment)) return null;
  if (firstSegment === "cart") return "cart";
  if (["shop", "search", "product-details"].includes(firstSegment)) return "categories";
  if (["account", "wishlist", "user-dashboard", "order"].includes(firstSegment)) return "account";
  return "home";
}

/**
 * Fixed primary navigation for phone and tablet storefront views.
 * It owns route highlighting and the live persisted cart badge so pages only
 * consume one reusable navigation family.
 */
export function MobileBottomNavigation({ locale, pathname, cartQuantity }: MobileBottomNavigationProps) {
  const activeDestination = resolveDestination(pathname);
  if (!activeDestination) return null;

  const t = getDict(locale);
  const items = [
    { id: "home" as const, href: "/", label: t.common.home, Icon: HomeIcon },
    { id: "categories" as const, href: "/shop", label: t.nav.categories, Icon: CategoriesIcon },
    { id: "cart" as const, href: "/cart", label: t.common.cart, Icon: ShoppingCartIcon },
    { id: "account" as const, href: "/account", label: t.nav.mobileAccount, Icon: UserIcon },
  ];

  return (
    <nav
      aria-label={t.nav.mobilePrimaryNavigation}
      className="vd-mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 block border-t border-vd-line bg-white shadow-[0_-12px_30px_-22px_rgba(11,11,11,0.45)] xl:hidden"
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <ul className="mx-auto grid h-[88px] max-w-[480px] grid-cols-4 items-stretch px-2 md:h-[96px] md:max-w-[1024px] md:items-center md:px-6">
        {items.map(({ id, href, label, Icon }) => {
          const active = activeDestination === id;
          return (
            <li key={id} className="min-w-0 md:flex md:items-center md:justify-center">
              <Link
                href={withLocalePath(href, locale)}
                aria-current={active ? "page" : undefined}
                className={`vd-focus relative flex h-full min-h-11 flex-col items-center justify-center gap-1 rounded-control px-1 text-center transition-colors md:h-[72px] md:w-[clamp(120px,15.625vw,160px)] ${active ? "font-extrabold text-jade md:bg-jade-tint" : "font-semibold text-vd-muted hover:text-jade md:hover:bg-surface-soft"}`}
              >
                <span className={`relative flex h-10 w-12 items-center justify-center rounded-control transition-colors md:h-[34px] md:w-[34px] ${active ? "bg-jade-tint md:bg-transparent" : "bg-transparent"}`}>
                  <Icon size={23} strokeWidth={active ? 2 : 1.7} className="md:h-[26px] md:w-[26px]" />
                  {id === "cart" && cartQuantity > 0 ? (
                    <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-jade px-1 text-[10px] font-extrabold leading-none text-white">
                      {formatNumber(cartQuantity, locale)}
                    </span>
                  ) : null}
                </span>
                <span className="block max-w-full truncate text-[11px] leading-4 md:text-xs">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
