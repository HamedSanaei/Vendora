/** Public presentation overrides shared by the two frontends; empty values retain Vendora defaults. */
export interface StoreProfile {
  nameFa?: string | null;
  nameEn?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  taglineFa?: string | null;
  taglineEn?: string | null;
  introFa?: string | null;
  introEn?: string | null;
  phone?: string | null;
  email?: string | null;
  addressFa?: string | null;
  addressEn?: string | null;
  hoursFa?: string | null;
  hoursEn?: string | null;
  socialProfiles?: string | null;
  copyrightFa?: string | null;
  copyrightEn?: string | null;
  enamadEnabled?: boolean;
  enamad?: { href: string; imageUrl: string } | null;
}

/** Resolves only presentation defaults, keeping empty optional contact information absent. */
export function storePresentation(profile: StoreProfile, locale: 'fa' | 'en') {
  const fa = locale === 'fa';
  const customName = (fa ? profile.nameFa : profile.nameEn)?.trim();
  return {
    name: customName || (fa ? 'وندورا' : 'Vendora'),
    wordmark: customName || 'VENDORA',
    tagline: (fa ? profile.taglineFa : profile.taglineEn) || (fa ? 'وندورا' : 'Bag Manufacturer'),
    footerTagline: (fa ? profile.taglineFa : profile.taglineEn) || (fa ? 'تولیدکننده تخصصی کیف‌های کاربردی' : 'Specialised manufacturer of practical bags'),
    intro: (fa ? profile.introFa : profile.introEn) || '',
    address: (fa ? profile.addressFa : profile.addressEn) || '',
    hours: (fa ? profile.hoursFa : profile.hoursEn) || '',
    copyright: (fa ? profile.copyrightFa : profile.copyrightEn) || (fa ? '© ۱۴۰۵ وندورا · تمامی حقوق محفوظ است.' : '© 2026 Vendora · All rights reserved.'),
  };
}

/** Substitutes the configured localized brand in existing copy without changing default text. */
export function brandText(text: string, profile: StoreProfile, locale: 'fa' | 'en'): string {
  const name = locale === 'fa' ? profile.nameFa : profile.nameEn;
  return name?.trim() ? text.replace(/وندورا|VENDORA|Vendora/g, () => name.trim()) : text;
}
