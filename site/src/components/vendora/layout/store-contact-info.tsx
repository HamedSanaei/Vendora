'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/locale-path';
import { storePresentation, useStoreSettings } from './store-settings-provider';

/** Preserves the original contact page until settings are saved, then uses the same public contact data as the footer. */
export function StoreContactInfo({ fallback }: { fallback: ReactNode }) {
  const profile = useStoreSettings();
  const locale = getLocaleFromPathname(usePathname());
  const brand = storePresentation(profile, locale);
  const fa = locale === 'fa';
  if (!Object.values(profile).some(Boolean)) return fallback;
  return <main className="vd-root vd-container py-12 text-start" dir={fa ? 'rtl' : 'ltr'}>
    <h1 className="text-3xl font-bold text-ink">{fa ? 'تماس با ما' : 'Contact us'}</h1>
    <p className="mt-4 text-lg font-semibold text-jade">{brand.name}</p>
    {brand.intro && <p className="mt-4 max-w-2xl whitespace-pre-line leading-8 text-vd-muted">{brand.intro}</p>}
    <div className="mt-8 grid gap-6 rounded-tile border border-vd-line p-6 md:grid-cols-2">
      {profile.phone && <section><h2 className="font-bold">{fa ? 'تلفن' : 'Phone'}</h2><a className="vd-focus mt-2 inline-block" dir="ltr" href={`tel:${profile.phone.replace(/[^+0-9]/g, '')}`}>{profile.phone}</a></section>}
      {profile.email && <section><h2 className="font-bold">{fa ? 'ایمیل' : 'Email'}</h2><a className="vd-focus mt-2 inline-block break-all" dir="ltr" href={`mailto:${profile.email}`}>{profile.email}</a></section>}
      {brand.address && <section><h2 className="font-bold">{fa ? 'آدرس' : 'Address'}</h2><address className="mt-2 whitespace-pre-line not-italic leading-8">{brand.address}</address></section>}
      {brand.hours && <section><h2 className="font-bold">{fa ? 'ساعات پاسخ‌گویی' : 'Support hours'}</h2><p className="mt-2 leading-8">{brand.hours}</p></section>}
      {profile.socialProfiles && <section className="md:col-span-2"><h2 className="font-bold">{fa ? 'شبکه‌های اجتماعی' : 'Social profiles'}</h2><nav className="mt-3 flex flex-wrap gap-4">{profile.socialProfiles.split('\n').filter(Boolean).map(url => <a className="vd-focus break-all text-jade" key={url} href={url} dir="ltr" target="_blank" rel="noopener noreferrer">{url}</a>)}</nav></section>}
    </div>
  </main>;
}
