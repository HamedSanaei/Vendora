import type { ReactNode, SVGProps } from 'react';

export type AdminIconName =
  | 'alert'
  | 'arrow'
  | 'brand'
  | 'category'
  | 'chevron'
  | 'close'
  | 'coupon'
  | 'dashboard'
  | 'download'
  | 'edit'
  | 'grid'
  | 'list'
  | 'logout'
  | 'menu'
  | 'newsletter'
  | 'orders'
  | 'package'
  | 'plus'
  | 'products'
  | 'search'
  | 'staff'
  | 'store'
  | 'trash'
  | 'users';

interface AdminIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: AdminIconName;
  size?: number;
}

const iconPaths: Record<AdminIconName, ReactNode> = {
  alert: <><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  arrow: <><path d="m9 18 6-6-6-6"/></>,
  brand: <><path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5v-11Z"/><path d="M8.5 9.5 12 11l3.5-1.5"/><path d="M12 11v6"/></>,
  category: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  coupon: <><path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 0 0-6V5H3v4Z"/><path d="m9 15 6-6"/><path d="M9 9h.01"/><path d="M15 15h.01"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/></>,
  download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list: <><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>,
  logout: <><path d="M10 17 15 12 10 7"/><path d="M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  newsletter: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  orders: <><path d="M6 3h12l2 4-8 4-8-4 2-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></>,
  package: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  products: <><path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  staff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  store: <><path d="M3 10 5 4h14l2 6"/><path d="M5 14v7h14v-7"/><path d="M9 21v-6h6v6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></>,
};

/** Renders the dependency-free stroke icon set used by the Penpot admin components. */
export function AdminIcon({ name, size = 20, ...props }: AdminIconProps) {
  return (
    <svg
      aria-hidden={props['aria-label'] ? undefined : true}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
