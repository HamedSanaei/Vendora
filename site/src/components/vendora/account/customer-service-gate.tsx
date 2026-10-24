'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { completeProfileHref, readCustomerAccount, accountToken, profileReturnTo, profileErrorCode } from '@/lib/auth/customer-profile';
import { profileCopy } from '@/lib/auth/profile-copy';
import { withLocalePath } from '@/lib/locale-path';
import type { Locale } from '@/lib/vendora/types';
import { VendoraButton } from '@/components/vendora/ui/button';

/** Checks fresh server facts before rendering new-service screens; account/security/history remain accessible. */
export function CustomerServiceGate({ children, locale, returnTo }: { children: ReactNode; locale: Locale; returnTo: string }) {
  const router = useRouter(), t = profileCopy(locale);
  const [ready, setReady] = useState(false), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!accountToken()) { router.replace(`${withLocalePath('/login', locale)}?returnTo=${encodeURIComponent(profileReturnTo(returnTo, locale))}`); return; }
    readCustomerAccount(controller.signal).then(account => {
      if (account.completion?.isComplete) setReady(true);
      else router.replace(completeProfileHref(locale, returnTo));
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (profileErrorCode(failure) === 'UNAUTHORIZED') router.replace(`${withLocalePath('/login', locale)}?returnTo=${encodeURIComponent(profileReturnTo(returnTo, locale))}`);
      else setError(true);
    });
    return () => controller.abort();
  }, [locale, returnTo, revision, router]);
  if (ready) return <>{children}</>;
  return <div className="vd-container flex min-h-[50vh] flex-col items-center justify-center gap-4 text-sm text-vd-muted" role="status">
    {error ? t.failed : t.loading}{error && <VendoraButton onClick={() => { setError(false); setRevision(value => value + 1); }}>{t.retry}</VendoraButton>}
  </div>;
}
