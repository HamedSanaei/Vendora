import { useEffect, useState, type ReactNode } from 'react';
import { httpClient } from '../../../lib/api/httpClient';
import { StoreSettingsContext, storeImageUrl, useAdminStoreSettings, type StoreProfile } from '../storeSettings';
import '../styles/store-settings.css';

/** Loads public branding even on sign-in pages; drafts never update the saved presentation. */
export function AdminStoreSettingsProvider({ children }: { children: ReactNode }) {
  const [profile, update] = useState<StoreProfile>({});
  useEffect(() => {
    let active = true;
    void httpClient.get<StoreProfile>('/api/store-settings').then(result => { if (active) update(result.data); }).catch(() => { /* Keep Vendora available during API outages. */ });
    return () => { active = false; };
  }, []);
  return <StoreSettingsContext.Provider value={{ profile, update }}>{children}</StoreSettingsContext.Provider>;
}

/** Updates the browser title/icon after locale changes or a successful save, including reset to defaults. */
export function AdminStoreDocument({ locale }: { locale: 'fa' | 'en' }) {
  const { profile } = useAdminStoreSettings();
  useEffect(() => {
    const name = locale === 'fa' ? profile.nameFa : profile.nameEn;
    document.title = name ? `${name} | ${locale === 'fa' ? 'مدیریت فروشگاه' : 'Administration'}` : 'Vendora';
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
    icon.href = profile.faviconUrl ? storeImageUrl(profile.faviconUrl) : '/favicon.svg';
    icon.type = profile.faviconUrl ? 'image/png' : 'image/svg+xml';
  }, [profile, locale]);
  return null;
}
