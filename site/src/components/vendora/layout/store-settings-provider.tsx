'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getDict } from '@/lib/vendora/i18n';
import { brandText, storePresentation, type StoreProfile } from '@/lib/store-settings';
export { brandText, storePresentation } from '@/lib/store-settings';
export type { StoreProfile } from '@/lib/store-settings';

const StoreSettingsContext = createContext<StoreProfile>({});

/** Hydrates server-read settings for all storefront components without per-component requests. */
export function StoreSettingsProvider({ profile, children }: { profile: StoreProfile; children: ReactNode }) {
  return <StoreSettingsContext.Provider value={profile}>{children}</StoreSettingsContext.Provider>;
}

/** Returns the saved overrides for the current server-rendered page. */
export function useStoreSettings() { return useContext(StoreSettingsContext); }

/** Localizes the existing dictionary's brand mentions while preserving all original default copy. */
export function useBrandCopy(locale: 'fa' | 'en') {
  const profile = useStoreSettings();
  const original = getDict(locale);
  /** Replaces brand mentions in localized string leaves; formatter functions retain their original behavior. */
  function replaceBrand(value: unknown): unknown {
    if (typeof value === 'string') return brandText(value, profile, locale);
    if (Array.isArray(value)) return value.map(replaceBrand);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceBrand(item)]));
    return value;
  }
  const dictionary = replaceBrand(original) as typeof original;
  const brand = storePresentation(profile, locale);
  return {
    ...dictionary,
    nav: { ...dictionary.nav, journal: brandText(dictionary.nav.journal, profile, locale), mobileSearchPlaceholder: brandText(dictionary.nav.mobileSearchPlaceholder, profile, locale) },
    footer: { ...dictionary.footer, tagline: brand.footerTagline, copyright: brandText(brand.copyright, profile, locale), columns: dictionary.footer.columns.map(column => ({ ...column, title: brandText(column.title, profile, locale) })) },
    home: { ...dictionary.home, heroBody: brand.intro || brandText(dictionary.home.heroBody, profile, locale), heroSecondary: brandText(dictionary.home.heroSecondary, profile, locale), storyTitle: brandText(dictionary.home.storyTitle, profile, locale), storyBody: brandText(dictionary.home.storyBody, profile, locale) },
    about: { ...dictionary.about, title: brandText(dictionary.about.title, profile, locale), body: brand.intro || brandText(dictionary.about.body, profile, locale) },
  };
}
