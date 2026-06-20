import { makeAutoObservable, runInAction } from 'mobx';
import { getAdminUsers, requestAdminPasswordReset, updateAdminUser } from '../api/adminApi';
import type { AdminUser, AdminUserInput } from '../types';

export class AdminUserStore {
  users: AdminUser[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads user rows. */
  async loadUsers(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const users = await getAdminUsers();
      runInAction(() => {
        this.users = users;
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

  /** Updates a user. */
  async updateUser(id: string, input: AdminUserInput): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await updateAdminUser(id, input);
      await this.loadUsers();
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

  /** Requests the safe password reset placeholder. */
  async requestPasswordReset(id: string): Promise<string> {
    return requestAdminPasswordReset(id);
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : 'Unable to save user.';
}
