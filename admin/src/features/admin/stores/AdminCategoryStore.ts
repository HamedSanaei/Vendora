import { makeAutoObservable, runInAction } from 'mobx';
import { createAdminCategory, deleteAdminCategory, getAdminCategories, updateAdminCategory } from '../api/adminApi';
import type { AdminCategory, AdminCategoryInput } from '../types';

export class AdminCategoryStore {
  categories: AdminCategory[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads category rows. */
  async loadCategories(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const categories = await getAdminCategories();
      runInAction(() => {
        this.categories = categories;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load categories.';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Creates a category and refreshes rows. */
  async createCategory(input: AdminCategoryInput): Promise<boolean> {
    return this.mutate(() => createAdminCategory(input));
  }

  /** Updates a category and refreshes rows. */
  async updateCategory(id: string, input: AdminCategoryInput): Promise<boolean> {
    return this.mutate(() => updateAdminCategory(id, input));
  }

  /** Soft deletes a category and refreshes rows. */
  async deleteCategory(id: string): Promise<boolean> {
    return this.mutate(async () => {
      await deleteAdminCategory(id);
      return null;
    });
  }

  private async mutate(action: () => Promise<AdminCategory | null>): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await action();
      await this.loadCategories();
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

  return error instanceof Error ? error.message : 'Unable to save category.';
}
