import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { adminPath, adminText, normalizeAdminLocale, type AdminLocale, type AdminMessageKey } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';

interface AdminMenuItem {
  titleKey: AdminMessageKey;
  path: (locale: AdminLocale) => string;
  icon: string;
  children?: Array<{ titleKey: AdminMessageKey; path: (locale: AdminLocale) => string }>;
}

const menuItems: AdminMenuItem[] = [
  { titleKey: 'dashboard', path: (locale) => adminPath(locale, 'dashboard'), icon: 'D' },
  {
    titleKey: 'products',
    path: (locale) => adminPath(locale, 'product-list'),
    icon: 'P',
    children: [
      { titleKey: 'productList', path: (locale) => adminPath(locale, 'product-list') },
      { titleKey: 'productGrid', path: (locale) => adminPath(locale, 'product-grid') },
      { titleKey: 'addProduct', path: (locale) => adminPath(locale, 'add-product') },
    ],
  },
  { titleKey: 'category', path: (locale) => adminPath(locale, 'category'), icon: 'C' },
  { titleKey: 'orders', path: (locale) => adminPath(locale, 'orders'), icon: 'O' },
  { titleKey: 'brand', path: (locale) => adminPath(locale, 'brands'), icon: 'B' },
  { titleKey: 'coupons', path: (locale) => adminPath(locale, 'coupon'), icon: '%' },
  { titleKey: 'profile', path: (locale) => adminPath(locale, 'profile'), icon: 'U' },
  { titleKey: 'onlineStore', path: (locale) => adminPath(locale, 'online-store'), icon: 'S' },
  { titleKey: 'staff', path: (locale) => adminPath(locale, 'our-staff'), icon: 'T' },
  {
    titleKey: 'pages',
    path: (locale) => adminPath(locale, 'pages'),
    icon: 'F',
    children: [
      { titleKey: 'register', path: (locale) => adminPath(locale, 'register') },
      { titleKey: 'login', path: (locale) => adminPath(locale, 'login') },
      { titleKey: 'forgotPassword', path: (locale) => adminPath(locale, 'forgot-password') },
    ],
  },
];

/** Provides the localized admin shell and navigation. */
export const AdminLayout = observer(function AdminLayout() {
  const store = useAdminStore();
  const params = useParams();
  const location = useLocation();
  const locale = normalizeAdminLocale(params.locale);
  const [openMenu, setOpenMenu] = useState<AdminMessageKey>('products');
  const isAuthRoute = /\/(login|register|forgot-password|reset-password)$/.test(location.pathname);

  useEffect(() => {
    void store.bootstrap();
  }, [store]);

  if (params.locale !== locale) {
    return <Navigate to={adminPath(locale)} replace />;
  }

  if (!isAuthRoute && !store.auth.isLoading && !store.auth.isAdmin) {
    return <Navigate to={adminPath(locale, 'login')} replace />;
  }

  return (
    <div className="admin-shell" lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <aside className={`admin-sidebar ${store.ui.isSidebarOpen ? 'admin-sidebar-open' : ''}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark">V</span>
          <span>Vendora</span>
        </div>
        <nav className="admin-menu" aria-label="Admin navigation">
          {menuItems.map((item) => {
            if (item.children) {
              const isOpen = openMenu === item.titleKey;
              return (
                <div className="admin-menu-group" key={item.titleKey}>
                  <button
                    className={`admin-menu-link admin-menu-parent ${isOpen ? 'admin-menu-link-active' : ''}`}
                    type="button"
                    onClick={() => setOpenMenu(isOpen ? 'dashboard' : item.titleKey)}
                  >
                    <span className="admin-menu-icon">{item.icon}</span>
                    <span>{adminText(locale, item.titleKey)}</span>
                    <span className={`admin-menu-chevron ${isOpen ? 'admin-menu-chevron-open' : ''}`}>›</span>
                  </button>
                  <div className={`admin-submenu ${isOpen ? 'admin-submenu-open' : ''}`}>
                    {item.children.map((child) => (
                      <NavLink
                        key={child.titleKey}
                        to={child.path(locale)}
                        onClick={() => store.ui.closeSidebar()}
                        className={(state: { isActive: boolean }) =>
                          `admin-submenu-link ${state.isActive ? 'admin-submenu-link-active' : ''}`
                        }
                      >
                        {adminText(locale, child.titleKey)}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.titleKey}
                to={item.path(locale)}
                onClick={() => store.ui.closeSidebar()}
                className={(state: { isActive: boolean }) =>
                  `admin-menu-link ${state.isActive ? 'admin-menu-link-active' : ''}`
                }
              >
                <span className="admin-menu-icon">{item.icon}</span>
                {adminText(locale, item.titleKey)}
              </NavLink>
            );
          })}
        </nav>
        <button
          className="admin-logout-btn"
          type="button"
          onClick={() => {
            store.auth.logout();
          }}
        >
          {adminText(locale, 'logout')}
        </button>
      </aside>

      <button
        className={`admin-backdrop ${store.ui.isSidebarOpen ? 'admin-backdrop-visible' : ''}`}
        type="button"
        aria-label="Close sidebar"
        onClick={() => store.ui.closeSidebar()}
      />

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <button className="admin-menu-button" type="button" onClick={() => store.ui.toggleSidebar()}>
              {adminText(locale, 'menu')}
            </button>
            <div className="admin-search">
              <input type="search" placeholder={adminText(locale, 'search')} aria-label="Search admin panel" />
            </div>
          </div>
          <div className="admin-profile">
            <span className="admin-profile-dot" />
            <div>
              <strong>{store.auth.profile?.fullName ?? 'Vendora Admin'}</strong>
              <small>{store.auth.profile?.email ?? 'admin@vendora.local'}</small>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
      <ToastContainer position={locale === 'fa' ? 'bottom-left' : 'bottom-right'} rtl={locale === 'fa'} />
    </div>
  );
});
