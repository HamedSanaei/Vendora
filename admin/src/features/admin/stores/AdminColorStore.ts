import { makeAutoObservable, runInAction } from 'mobx';
import { createAdminColor, deleteAdminColor, getAdminManageColors, updateAdminColor } from '../api/adminApi';
import type { AdminColor, AdminColorInput } from '../types';

export class AdminColorStore {
  colors: AdminColor[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads all color rows for the admin color management page. */
  async loadColors(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const colors = await getAdminManageColors();
      runInAction(() => {
        this.colors = colors;
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

  /** Creates a color and refreshes the management table. */
  async createColor(input: AdminColorInput): Promise<boolean> {
    return this.mutate(() => createAdminColor(input));
  }

  /** Updates a color and refreshes the management table. */
  async updateColor(id: string, input: AdminColorInput): Promise<boolean> {
    return this.mutate(() => updateAdminColor(id, input));
  }

  /** Soft deletes a color and refreshes the management table. */
  async deleteColor(id: string): Promise<boolean> {
    return this.mutate(async () => {
      await deleteAdminColor(id);
      return null;
    });
  }

  private async mutate(action: () => Promise<AdminColor | null>): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await action();
      await this.loadColors();
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

  return error instanceof Error ? error.message : 'Unable to save color.';
}
