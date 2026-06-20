import { makeAutoObservable, runInAction } from 'mobx';
import { getAdminDashboard } from '../api/adminApi';
import type { AdminDashboardStats, AdminOrder, AdminProduct } from '../types';

export class AdminDashboardStore {
  stats: AdminDashboardStats | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Calculates dashboard totals from currently available admin data. */
  async loadDashboard(products: AdminProduct[], orders: AdminOrder[]): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const stats = await getAdminDashboard(products, orders);
      runInAction(() => {
        this.stats = stats;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load dashboard.';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }
}
