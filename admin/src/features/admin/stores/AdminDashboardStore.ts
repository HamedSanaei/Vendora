import { makeAutoObservable, runInAction } from 'mobx';
import { getAdminDashboard } from '../api/adminApi';
import type { AdminDashboardStats } from '../types';

export class AdminDashboardStore {
  stats: AdminDashboardStats | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads persisted dashboard totals and chart data. */
  async loadDashboard(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const stats = await getAdminDashboard();
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
