import { makeAutoObservable, runInAction } from 'mobx';
import { downloadAdminNewsletterSubscriptionsCsv, getAdminNewsletterSubscriptions } from '../api/adminApi';
import type { AdminNewsletterSubscription } from '../types';

export class AdminNewsletterStore {
  subscriptions: AdminNewsletterSubscription[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads storefront newsletter subscribers for the admin table. */
  async loadSubscriptions(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const subscriptions = await getAdminNewsletterSubscriptions();
      runInAction(() => {
        this.subscriptions = subscriptions;
      });
    } catch (error) {
      runInAction(() => {
        this.error = extractErrorMessage(error);
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Downloads the CSV export for storefront newsletter subscribers. */
  async downloadCsv(): Promise<Blob | null> {
    this.error = null;

    try {
      return await downloadAdminNewsletterSubscriptionsCsv();
    } catch (error) {
      runInAction(() => {
        this.error = extractErrorMessage(error);
      });
      return null;
    }
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : 'Unable to load newsletter subscriptions.';
}
