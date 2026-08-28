/**
 * Account navigation model shared by the desktop sidebar and the mobile
 * drawer (Penpot "Vendora / Account / Sidebar" + "Drawer / Mobile").
 * Routes follow the centralised locale-aware route matrix; labels come from
 * the i18n dictionary (`account.menu`).
 */
export const accountNavItems: { key: string; href: string }[] = [
  { key: "overview", href: "/account" },
  { key: "profile", href: "/account/profile" },
  { key: "security", href: "/account/security" },
  { key: "addresses", href: "/account/addresses" },
  { key: "orders", href: "/account/orders" },
  { key: "returns", href: "/account/returns" },
  { key: "transactions", href: "/account/transactions" },
  { key: "wishlist", href: "/account/wishlist" },
  { key: "quickPay", href: "/account/quick-pay" },
];

/**
 * Resolves whether an account nav item is active for the given pathname.
 * Detail routes (orders/:id, returns/new) highlight their parent item.
 */
export function isAccountItemActive(itemHref: string, pathname: string): boolean {
  const path = pathname.replace(/^\/(fa|en)(?=\/|$)/, "");
  if (itemHref === "/account") {
    return path === "/account";
  }
  return path.startsWith(itemHref);
}
