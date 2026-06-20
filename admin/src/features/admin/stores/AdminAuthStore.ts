import { makeAutoObservable, runInAction } from 'mobx';
import { setHttpAuthToken } from '../../../lib/api/httpClient';
import {
  forgotAdminPassword,
  getAdminMe,
  loginAdmin,
  registerAdmin,
  resetAdminPassword,
} from '../api/adminApi';
import type { AdminAuthProfile } from '../types';

export class AdminAuthStore {
  profile: AdminAuthProfile | null = null;
  token: string | null = localStorage.getItem('vendora_admin_token');
  isLoading = false;
  error: string | null = null;
  resetToken: string | null = null;

  constructor() {
    makeAutoObservable(this);
    setHttpAuthToken(this.token);
  }

  /** Returns whether the current account can access admin routes. */
  get isAdmin(): boolean {
    return this.profile?.role === 'Admin';
  }

  /** Loads the current account when a token already exists. */
  async loadCurrentUser(): Promise<void> {
    if (!this.token || this.profile) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const profile = await getAdminMe();
      runInAction(() => {
        this.profile = profile;
      });
    } catch (error) {
      runInAction(() => {
        this.logout();
        this.error = extractErrorMessage(error);
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Logs the user in and stores the bearer token. */
  async login(email: string, password: string): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      const account = await loginAdmin(email, password);
      runInAction(() => {
        this.token = account.token;
        this.profile = {
          id: account.id,
          fullName: account.fullName,
          email: account.email,
          role: account.role,
        };
        setHttpAuthToken(account.token);
      });

      return account.role === 'Admin';
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

  /** Registers an invited admin account. */
  async register(input: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    inviteCode: string;
  }): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      const account = await registerAdmin(input);
      runInAction(() => {
        this.token = account.token;
        this.profile = {
          id: account.id,
          fullName: account.fullName,
          email: account.email,
          role: account.role,
        };
        setHttpAuthToken(account.token);
      });

      return account.role === 'Admin';
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

  /** Requests a development reset token. */
  async forgotPassword(email: string): Promise<boolean> {
    this.isLoading = true;
    this.error = null;
    this.resetToken = null;

    try {
      const result = await forgotAdminPassword(email);
      runInAction(() => {
        this.resetToken = result.resetToken ?? null;
      });
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

  /** Resets the password with a token from the forgot-password flow. */
  async resetPassword(email: string, token: string, newPassword: string): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      await resetAdminPassword(email, token, newPassword);
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

  /** Clears local auth state and removes the bearer token. */
  logout(): void {
    this.profile = null;
    this.token = null;
    setHttpAuthToken(null);
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : 'Request failed.';
}
