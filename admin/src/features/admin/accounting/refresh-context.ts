import { createContext } from 'react';

/** Scoped invalidation for visible accounting queries only; never triggers bootstrap-wide loading. */
export const AccountingRefreshContext = createContext({ revision: 0, invalidate: () => {} });
