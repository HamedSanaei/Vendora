import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AccountingRefreshContext } from './refresh-context';

/** Keeps visible cards, lists and balances synchronized after confirmed writes without a new global store. */
export function AccountingDataProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const invalidate = useCallback(() => setRevision(value => value + 1), []);
  const value = useMemo(() => ({ revision, invalidate }), [revision, invalidate]);
  return <AccountingRefreshContext.Provider value={value}>{children}</AccountingRefreshContext.Provider>;
}
