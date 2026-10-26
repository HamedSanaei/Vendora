import { AdminSmsSettings } from "../components/AdminSmsSettings";
import { AdminShippingSettings } from "../components/AdminShippingSettings";
import { useRef, useState, type KeyboardEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AdminButton, AdminFeedback, AdminPageHeader } from '../components/AdminUi';
import { AdminIcon } from '../components/AdminIcon';
import { AdminSlideshowManager } from '../components/AdminSlideshowManager';
import { AdminStoreSettingsForm, type StoreProfileSection } from '../components/AdminStoreSettingsForm';
import { AdminSeedVisibility } from '../components/AdminSeedVisibility';
import { normalizeAdminLocale } from '../i18n';
import { storeManagementSection, storeManagementSections, type StoreManagementSection } from '../storeManagement';
import '../styles/store-settings.css';

/** Organizes existing store forms into URL-backed scopes, loading on first visit and retaining drafts across tabs. */
export function AdminOnlineStorePage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [params, setParams] = useSearchParams();
  const section = storeManagementSection(params);
  const profileSections: StoreProfileSection[] = ['identity', 'contact', 'trust'];
  const isProfile = profileSections.includes(section as StoreProfileSection);
  const panel = isProfile ? 'profile' : section;
  const [visited, setVisited] = useState<string[]>([panel]);
  if (!visited.includes(panel)) setVisited([...visited, panel]);
  const tabs = useRef<HTMLDivElement>(null);
  /** Preserves child filters and existing routes while allowing refresh/Back/Forward to restore the active scope. */
  function select(value: StoreManagementSection) {
    const next = new URLSearchParams(params); next.set('section', value); setParams(next);
  }
  /** Uses automatic activation and roving focus, with horizontal arrows following the active RTL/LTR direction. */
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest('[role="tab"]');
    if (!target || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = storeManagementSections.findIndex(item => item.id === target.getAttribute('data-section'));
    const delta = event.key === 'ArrowLeft' ? (isFa ? 1 : -1) : (isFa ? -1 : 1);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? storeManagementSections.length - 1 : (index + delta + storeManagementSections.length) % storeManagementSections.length;
    select(storeManagementSections[next].id);
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  const storefrontBaseUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const links = [
    { icon: 'store' as const, title: isFa ? 'صفحه اصلی فروشگاه' : 'Storefront home', description: isFa ? 'نسخه منتشرشده صفحه اصلی را در یک تب جدید ببینید.' : 'Open the localized storefront home in a new tab.', path: `/${locale}` },
    { icon: 'products' as const, title: isFa ? 'فهرست محصولات' : 'Product catalog', description: isFa ? 'صفحه Shop و کارت‌های محصول را پیش‌نمایش کنید.' : 'Preview the shop and product cards.', path: `/${locale}/shop` },
    { icon: 'orders' as const, title: isFa ? 'جریان خرید' : 'Checkout journey', description: isFa ? 'سبد خرید و مراحل Checkout را بررسی کنید.' : 'Review the cart and checkout journey.', path: `/${locale}/cart` },
  ];

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'تنظیمات فروشگاه' : 'Store settings'} title={isFa ? 'مدیریت فروشگاه' : 'Store management'} description={isFa ? 'بخش موردنظر را انتخاب کنید؛ تغییرات هر فرم با دکمهٔ ذخیرهٔ همان فرم اعمال می‌شوند.' : 'Choose a section. Publish changes using its form’s save action.'} />
      <div ref={tabs} className="admin-store-management-tabs" role="tablist" aria-label={isFa ? 'بخش‌های مدیریت فروشگاه' : 'Store management sections'} aria-orientation="horizontal" onKeyDown={keyboard}>
        {storeManagementSections.map(item => <AdminButton key={item.id} id={`store-tab-${item.id}`} data-section={item.id} role="tab" aria-selected={section === item.id} aria-controls={`store-panel-${profileSections.includes(item.id as StoreProfileSection) ? 'profile' : item.id}`} tabIndex={section === item.id ? 0 : -1} variant={section === item.id ? 'primary' : 'secondary'} onClick={() => select(item.id)}>{item[locale]}</AdminButton>)}
      </div>
      <div id="store-panel-profile" className="admin-store-management-panel" role="tabpanel" aria-labelledby={`store-tab-${isProfile ? section : 'identity'}`} hidden={!isProfile}>
        {visited.includes('profile') && <AdminStoreSettingsForm key={`settings-${locale}`} locale={locale} section={isProfile ? section as StoreProfileSection : 'identity'} onSectionChange={select} />}
      </div>
      <div id="store-panel-data" className="admin-store-management-panel" role="tabpanel" aria-labelledby="store-tab-data" hidden={section !== 'data'}>{visited.includes('data') && <AdminSeedVisibility locale={locale} />}</div>
      <div id="store-panel-shipping" className="admin-store-management-panel" role="tabpanel" aria-labelledby="store-tab-shipping" hidden={section !== 'shipping'}>{visited.includes('shipping') && <AdminShippingSettings locale={locale} />}</div>
      <div id="store-panel-sms" className="admin-store-management-panel" role="tabpanel" aria-labelledby="store-tab-sms" hidden={section !== 'sms'}>{visited.includes('sms') && <AdminSmsSettings locale={locale} active={section === 'sms'} />}</div>
      <div id="store-panel-slideshow" className="admin-store-management-panel" role="tabpanel" aria-labelledby="store-tab-slideshow" hidden={section !== 'slideshow'}>{visited.includes('slideshow') && <AdminSlideshowManager key={locale} locale={locale} />}</div>
      <div id="store-panel-preview" className="admin-store-management-panel" role="tabpanel" aria-labelledby="store-tab-preview" hidden={section !== 'preview'}>
      <AdminFeedback tone="info">{isFa ? 'نشانی فروشگاه: ' : 'Storefront address: '}<bdi dir="ltr">{storefrontBaseUrl}</bdi></AdminFeedback>
      <div className="admin-storefront-grid">
        {links.map((item) => <article className="admin-storefront-card" key={item.path}><span><AdminIcon name={item.icon} size={24} /></span><h2>{item.title}</h2><p>{item.description}</p><AdminButton external icon="arrow" to={`${storefrontBaseUrl}${item.path}`} variant="secondary">{isFa ? 'باز کردن' : 'Open'}</AdminButton></article>)}
      </div>
      </div>
    </section>
  );
}
