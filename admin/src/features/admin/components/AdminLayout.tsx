import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { adminPath, adminText, normalizeAdminLocale, type AdminLocale, type AdminMessageKey } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import { LoadingState } from './LoadingState';

interface AdminMenuItem {
  titleKey: AdminMessageKey;
  path: (locale: AdminLocale) => string;
  icon: AdminIconName;
  children?: Array<{ titleKey: AdminMessageKey; path: (locale: AdminLocale) => string }>;
}

interface AdminMenuSection {
  labelKey?: AdminMessageKey;
  items: AdminMenuItem[];
}

const menuSections: AdminMenuSection[] = [
  {
    items: [
      { titleKey: 'dashboard', path: (locale) => adminPath(locale, 'dashboard'), icon: 'dashboard' },
      {
        titleKey: 'products',
        path: (locale) => adminPath(locale, 'product-list'),
        icon: 'products',
        children: [
          { titleKey: 'productList', path: (locale) => adminPath(locale, 'product-list') },
          { titleKey: 'productGrid', path: (locale) => adminPath(locale, 'product-grid') },
          { titleKey: 'addProduct', path: (locale) => adminPath(locale, 'add-product') },
        ],
      },
      { titleKey: 'orders', path: (locale) => adminPath(locale, 'orders'), icon: 'orders' },
    ],
  },
  {
    labelKey: 'catalog',
    items: [
      { titleKey: 'category', path: (locale) => adminPath(locale, 'category'), icon: 'category' },
      { titleKey: 'brand', path: (locale) => adminPath(locale, 'brands'), icon: 'brand' },
      { titleKey: 'colors', path: (locale) => adminPath(locale, 'colors'), icon: 'category' },
      { titleKey: 'coupons', path: (locale) => adminPath(locale, 'coupon'), icon: 'coupon' },
    ],
  },
  {
    labelKey: 'customersGrowth',
    items: [
      { titleKey: 'profile', path: (locale) => adminPath(locale, 'profile'), icon: 'users' },
      { titleKey: 'subscribers', path: (locale) => adminPath(locale, 'newsletter-subscriptions'), icon: 'newsletter' },
    ],
  },
  {
    labelKey: 'teamStorefront',
    items: [
      { titleKey: 'staff', path: (locale) => adminPath(locale, 'our-staff'), icon: 'staff' },
      { titleKey: 'onlineStore', path: (locale) => adminPath(locale, 'online-store'), icon: 'store' },
    ],
  },
];

function resolvePageTitle(locale: AdminLocale, pathname: string): string {
  const entries: Array<[string, AdminMessageKey]> = [
    ['/products/', 'editProduct'],
    ['/add-product', 'addProduct'],
    ['/product-grid', 'productGrid'],
    ['/product-list', 'productList'],
    ['/orders/', 'orders'],
    ['/orders', 'orders'],
    ['/category', 'category'],
    ['/brands', 'brand'],
    ['/colors', 'colors'],
    ['/coupon', 'coupons'],
    ['/profile', 'profile'],
    ['/newsletter-subscriptions', 'subscribers'],
    ['/our-staff', 'staff'],
    ['/online-store', 'onlineStore'],
  ];
  const match = entries.find(([part]) => pathname.includes(part));
  return adminText(locale, match?.[1] ?? 'dashboard');
}

/** Provides the guarded, responsive Penpot admin shell and grouped navigation. */
export const AdminLayout = observer(function AdminLayout() {
  const store = useAdminStore();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = normalizeAdminLocale(params.locale);
  const [isReady, setIsReady] = useState(false);
  const [openMenu, setOpenMenu] = useState<AdminMessageKey | null>('products');
  const [globalSearch, setGlobalSearch] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pageTitle = useMemo(() => resolvePageTitle(locale, location.pathname), [locale, location.pathname]);
  const storefrontBaseUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  useEffect(() => {
    let active = true;
    void store.bootstrap().finally(() => {
      if (active) setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    store.ui.closeSidebar();
  }, [location.pathname, store.ui]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') store.ui.closeSidebar();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store.ui]);

  useEffect(() => {
    if (!store.ui.isSidebarOpen || window.matchMedia('(min-width: 1024px)').matches) {
      return undefined;
    }

    const sidebar = sidebarRef.current;
    const menuButton = menuButtonRef.current;
    if (!sidebar) {
      return undefined;
    }

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(sidebar.querySelectorAll<HTMLElement>(focusableSelector));
    focusableElements[0]?.focus();

    /** Keeps keyboard focus inside the open mobile navigation drawer. */
    function trapDrawerFocus(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    sidebar.addEventListener('keydown', trapDrawerFocus);
    return () => {
      sidebar.removeEventListener('keydown', trapDrawerFocus);
      menuButton?.focus();
    };
  }, [store.ui.isSidebarOpen]);

  if (params.locale !== locale) {
    return <Navigate to={adminPath(locale)} replace />;
  }

  if (!isReady || store.auth.isLoading) {
    return <div className="admin-boot-screen" lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}><LoadingState label={locale === 'fa' ? 'در حال آماده‌سازی پنل…' : 'Preparing admin…'} /></div>;
  }

  if (!store.auth.isAdmin) {
    const loginPath = `${adminPath(locale, 'login')}?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={loginPath} replace />;
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = globalSearch.trim();
    navigate(`${adminPath(locale, 'product-list')}${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  }

  function handleLogout(): void {
    store.auth.logout();
    navigate(adminPath(locale, 'login'), { replace: true });
  }

  const initials = (store.auth.profile?.fullName ?? 'Vendora Admin')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="admin-shell" data-admin-theme={locale === 'fa' ? 'penpot' : 'legacy'} lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <aside aria-modal={store.ui.isSidebarOpen ? 'true' : undefined} className={`admin-sidebar ${store.ui.isSidebarOpen ? 'admin-sidebar-open' : ''}`} id="admin-navigation" ref={sidebarRef} role={store.ui.isSidebarOpen ? 'dialog' : undefined}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><AdminIcon name="brand" size={22} /></span>
          <span className="admin-brand-copy"><strong>VENDORA</strong><small>{adminText(locale, 'adminPanel')}</small></span>
          <button className="admin-sidebar-close" onClick={() => store.ui.closeSidebar()} type="button" aria-label={locale === 'fa' ? 'بستن منو' : 'Close menu'}>
            <AdminIcon name="close" size={20} />
          </button>
        </div>

        <nav className="admin-menu" aria-label={locale === 'fa' ? 'منوی مدیریت' : 'Admin navigation'}>
          {menuSections.map((section, sectionIndex) => (
            <section className="admin-menu-section" key={section.labelKey ?? `main-${sectionIndex}`}>
              {section.labelKey ? <h2>{adminText(locale, section.labelKey)}</h2> : null}
              {section.items.map((item) => {
                const isOpen = openMenu === item.titleKey;
                if (item.children) {
                  const hasActiveChild = item.children.some((child) => location.pathname === child.path(locale));
                  return (
                    <div className="admin-menu-group" key={item.titleKey}>
                      <button
                        aria-expanded={isOpen}
                        className={`admin-menu-link admin-menu-parent ${hasActiveChild ? 'admin-menu-link-active' : ''}`}
                        onClick={() => setOpenMenu(isOpen ? null : item.titleKey)}
                        type="button"
                      >
                        <span className="admin-menu-icon"><AdminIcon name={item.icon} size={19} /></span>
                        <span>{adminText(locale, item.titleKey)}</span>
                        <AdminIcon className={`admin-menu-chevron ${isOpen ? 'admin-menu-chevron-open' : ''}`} name="chevron" size={17} />
                      </button>
                      <div className={`admin-submenu ${isOpen ? 'admin-submenu-open' : ''}`}>
                        {item.children.map((child) => (
                          <NavLink className={({ isActive }) => `admin-submenu-link ${isActive ? 'admin-submenu-link-active' : ''}`} key={child.titleKey} to={child.path(locale)}>
                            {adminText(locale, child.titleKey)}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <NavLink className={({ isActive }) => `admin-menu-link ${isActive ? 'admin-menu-link-active' : ''}`} key={item.titleKey} to={item.path(locale)}>
                    <span className="admin-menu-icon"><AdminIcon name={item.icon} size={19} /></span>
                    <span>{adminText(locale, item.titleKey)}</span>
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <a className="admin-store-link" href={`${storefrontBaseUrl}/${locale}`} rel="noreferrer" target="_blank">
            <AdminIcon name="store" size={18} /><span>{adminText(locale, 'openStore')}</span><AdminIcon className="admin-store-arrow" name="arrow" size={16} />
          </a>
          <button className="admin-logout-btn" onClick={handleLogout} type="button">
            <AdminIcon name="logout" size={18} /><span>{adminText(locale, 'logout')}</span>
          </button>
        </div>
      </aside>

      <button aria-label={locale === 'fa' ? 'بستن منو' : 'Close sidebar'} className={`admin-backdrop ${store.ui.isSidebarOpen ? 'admin-backdrop-visible' : ''}`} onClick={() => store.ui.closeSidebar()} type="button" />

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-context">
            <button aria-controls="admin-navigation" aria-expanded={store.ui.isSidebarOpen} aria-label={adminText(locale, 'menu')} className="admin-menu-button" onClick={() => store.ui.toggleSidebar()} ref={menuButtonRef} type="button">
              <AdminIcon name="menu" size={21} />
            </button>
            <nav aria-label={locale === 'fa' ? 'مسیر صفحه' : 'Breadcrumb'} className="admin-header-breadcrumb">
              <Link to={adminPath(locale, 'dashboard')}>{adminText(locale, 'adminPanel')}</Link>
              <span aria-hidden="true">/</span>
              <strong aria-current="page">{pageTitle}</strong>
            </nav>
          </div>

          <form className="admin-search" onSubmit={handleSearch} role="search">
            <AdminIcon name="search" size={18} />
            <input aria-label={adminText(locale, 'globalSearch')} onChange={(event) => setGlobalSearch(event.target.value)} placeholder={adminText(locale, 'globalSearch')} type="search" value={globalSearch} />
          </form>

          <Link className="admin-profile" to={adminPath(locale, 'profile')}>
            <span className="admin-profile-avatar">{initials}</span>
            <div><strong>{store.auth.profile?.fullName ?? 'Vendora Admin'}</strong><small>{adminText(locale, 'account')}</small></div>
            <AdminIcon className="admin-profile-chevron" name="chevron" size={16} />
          </Link>
        </header>

        <div className="admin-content"><Outlet /></div>
      </main>
      <ToastContainer autoClose={5000} closeOnClick newestOnTop pauseOnFocusLoss pauseOnHover position={locale === 'fa' ? 'bottom-left' : 'bottom-right'} rtl={locale === 'fa'} />
    </div>
  );
});
