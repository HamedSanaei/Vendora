import { makeAutoObservable, runInAction } from 'mobx';
import { createAdminCoupon, deleteAdminCoupon, getAdminCoupons, updateAdminCoupon } from '../api/adminApi';
import type { AdminCoupon, AdminCouponInput } from '../types';

export class AdminCouponStore {
  coupons: AdminCoupon[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads coupon rows. */
  async loadCoupons(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const coupons = await getAdminCoupons();
      runInAction(() => {
        this.coupons = coupons;
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

  /** Creates a coupon. */
  async createCoupon(input: AdminCouponInput): Promise<boolean> {
    return this.mutate(() => createAdminCoupon(input));
  }

  /** Updates a coupon. */
  async updateCoupon(id: string, input: AdminCouponInput): Promise<boolean> {
    return this.mutate(() => updateAdminCoupon(id, input));
  }

  /** Soft deletes a coupon. */
  async deleteCoupon(id: string): Promise<boolean> {
    return this.mutate(async () => {
      await deleteAdminCoupon(id);
      return null;
    });
  }

  private async mutate(action: () => Promise<AdminCoupon | null>): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await action();
      await this.loadCoupons();
      return true;
    } catch (error) {
      runInAction(() => {
        this.error = extractErrorMessage(error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
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

  return error instanceof Error ? error.message : 'Unable to save coupon.';
}
