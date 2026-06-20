import { makeAutoObservable, runInAction } from 'mobx';
import { createAdminBrand, deleteAdminBrand, getAdminBrands, updateAdminBrand } from '../api/adminApi';
import type { AdminBrand, AdminBrandInput } from '../types';

export class AdminBrandStore {
  brands: AdminBrand[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads brand rows. */
  async loadBrands(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const brands = await getAdminBrands();
      runInAction(() => {
        this.brands = brands;
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

  /** Creates a brand. */
  async createBrand(input: AdminBrandInput): Promise<boolean> {
    return this.mutate(() => createAdminBrand(input));
  }

  /** Updates a brand. */
  async updateBrand(id: string, input: AdminBrandInput): Promise<boolean> {
    return this.mutate(() => updateAdminBrand(id, input));
  }

  /** Soft deletes a brand. */
  async deleteBrand(id: string): Promise<boolean> {
    return this.mutate(async () => {
      await deleteAdminBrand(id);
      return null;
    });
  }

  private async mutate(action: () => Promise<AdminBrand | null>): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await action();
      await this.loadBrands();
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

  return error instanceof Error ? error.message : 'Unable to save brand.';
}
