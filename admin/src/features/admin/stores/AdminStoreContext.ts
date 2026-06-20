import { createContext, useContext } from 'react';
import { AdminRootStore } from './AdminRootStore';

const adminStore = new AdminRootStore();
const AdminStoreContext = createContext<AdminRootStore>(adminStore);

/** Provides access to the shared admin MobX root store. */
export function useAdminStore(): AdminRootStore {
  return useContext(AdminStoreContext);
}

export { AdminStoreContext, adminStore };
