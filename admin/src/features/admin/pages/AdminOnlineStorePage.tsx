import { useParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminPageHeader } from '../components/AdminUi';
import { AdminIcon } from '../components/AdminIcon';
import { AdminSlideshowManager } from '../components/AdminSlideshowManager';
import { normalizeAdminLocale } from '../i18n';
import { slideshowCopy } from '../slideshowCopy';

/** Manages homepage slideshow photos alongside the existing localized storefront shortcuts. */
export function AdminOnlineStorePage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const copy = slideshowCopy(locale);
  const storefrontBaseUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const links = [
    { icon: 'store' as const, title: isFa ? 'صفحه اصلی فروشگاه' : 'Storefront home', description: isFa ? 'نسخه منتشرشده صفحه اصلی را در یک تب جدید ببینید.' : 'Open the localized storefront home in a new tab.', path: `/${locale}` },
    { icon: 'products' as const, title: isFa ? 'فهرست محصولات' : 'Product catalog', description: isFa ? 'صفحه Shop و کارت‌های محصول را پیش‌نمایش کنید.' : 'Preview the shop and product cards.', path: `/${locale}/shop` },
    { icon: 'orders' as const, title: isFa ? 'جریان خرید' : 'Checkout journey', description: isFa ? 'سبد خرید و مراحل Checkout را بررسی کنید.' : 'Review the cart and checkout journey.', path: `/${locale}/cart` },
  ];

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'پیش‌نمایش Storefront' : 'Storefront preview'} title={isFa ? 'فروشگاه آنلاین' : 'Online store'} description={copy.pageDescription} />
      <AdminSlideshowManager key={locale} locale={locale} />
      <AdminFeedback tone="info"><span dir="ltr">VITE_STOREFRONT_URL = {storefrontBaseUrl}</span></AdminFeedback>
      <div className="admin-storefront-grid">
        {links.map((item) => <article className="admin-storefront-card" key={item.path}><span><AdminIcon name={item.icon} size={24} /></span><h2>{item.title}</h2><p>{item.description}</p><AdminButton external icon="arrow" to={`${storefrontBaseUrl}${item.path}`} variant="secondary">{isFa ? 'باز کردن' : 'Open'}</AdminButton></article>)}
      </div>
    </section>
  );
}
