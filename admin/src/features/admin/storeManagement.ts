export const storeManagementSections = [
  { id: 'identity', fa: 'هویت و ظاهر', en: 'Identity & branding' },
  { id: 'contact', fa: 'تماس و پشتیبانی', en: 'Contact & support' },
  { id: 'trust', fa: 'نماد اعتماد', en: 'Trust badge' },
  { id: 'slideshow', fa: 'اسلایدر صفحه اصلی', en: 'Homepage slideshow' },
  { id: 'shipping', fa: 'ارسال و قیمت‌گذاری', en: 'Shipping & pricing' },
  { id: 'sms', fa: 'پیامک و اعلان‌ها', en: 'SMS & notifications' },
  { id: 'data', fa: 'داده‌های نمونه', en: 'Sample data' },
  { id: 'preview', fa: 'مشاهده فروشگاه', en: 'View storefront' },
] as const;
export type StoreManagementSection = typeof storeManagementSections[number]['id'];

/** Keeps existing SMS bookmarks usable while making the selected management scope URL-addressable. */
export function storeManagementSection(params: URLSearchParams): StoreManagementSection {
  const value = params.get('section');
  if (storeManagementSections.some(section => section.id === value)) return value as StoreManagementSection;
  if (!value && ['smsTab','smsPage','smsStatus'].some(key => params.has(key))) return 'sms';
  return 'identity';
}
