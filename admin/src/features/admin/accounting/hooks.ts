import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { accountingError, accountingRead, accountingWrite } from './api';
import { useSearchParams } from 'react-router-dom';
import { AccountingRefreshContext } from './refresh-context';

/** Keeps page and filters in the URL for refresh and browser navigation. */
export function useAccountingQuery() {
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get('page'));
  const page = Number.isFinite(rawPage) ? Math.min(100000, Math.max(1, Math.floor(rawPage))) : 1;
  const set = (name: string, value: string) => setParams(old => {
    const next = new URLSearchParams(old); if (value) next.set(name, value); else next.delete(name);
    if (name !== 'page') next.delete('page'); return next;
  });
  return { params, page, set, onPage: (value: number) => set('page', String(value)) };
}

/** Loads only the active accounting screen and cancels obsolete filter/page requests. */
export function useAccountingData<T>(path: string | null, fa: boolean) {
  const [result, setResult] = useState<{ path: string | null; data?: T; error: string; loading: boolean }>({ path: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const shared = useContext(AccountingRefreshContext);
  const requestKey = `${path}|${revision}|${shared.revision}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    accountingRead<T>(path, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ path: requestKey, data, error: '', loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path: requestKey, error: accountingError(error, fa), loading: false });
    });
    return () => controller.abort();
  }, [path, fa, requestKey]);
  return { data: result.path === requestKey ? result.data : undefined, error: result.path === requestKey ? result.error : '', loading: Boolean(path) && (result.path !== requestKey || result.loading), reload: useCallback(() => setRevision(x => x + 1), []) };
}

/** Keeps each payload's key on uncertain failures; changed payloads never reuse an old operation key. */
export function useAccountingWrite(fa: boolean) {
  const { invalidate } = useContext(AccountingRefreshContext);
  const keys = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (path: string, payload: unknown, success: (id: string) => void) => {
    if (inFlight.current) return;
    const fingerprint = path + JSON.stringify(payload);
    const key = keys.current.get(fingerprint) ?? crypto.randomUUID();
    keys.current.set(fingerprint, key); inFlight.current = true; setBusy(true); setError('');
    try { const id = await accountingWrite(path, payload, key); keys.current.delete(fingerprint); success(id); invalidate(); }
    catch (failure) { setError(accountingError(failure, fa)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { run, busy, error };
}
