import { makeAutoObservable, runInAction } from 'mobx';
import {
  createAdminProduct,
  getAdminColors,
  getAdminCategoryOptions,
  getAdminProduct,
  getAdminProducts,
  updateAdminProduct,
} from '../api/adminApi';
import type { AdminCatalogColor, AdminCategoryOption, AdminProduct, CreateAdminProductInput } from '../types';

export class AdminProductStore {
  products: AdminProduct[] = [];
  categoryOptions: AdminCategoryOption[] = [];
  colorOptions: AdminCatalogColor[] = [];
  isLoading = false;
  isSaving = false;
  error: string | null = null;
  saveError: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads product rows for admin product screens. */
  async loadProducts(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const products = await getAdminProducts();
      runInAction(() => {
        this.products = products;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load products.';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Loads real category options for product forms. */
  async loadCategoryOptions(): Promise<void> {
    try {
      const categoryOptions = await getAdminCategoryOptions();
      runInAction(() => {
        this.categoryOptions = categoryOptions;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load categories.';
      });
    }
  }

  /** Loads real color options for product forms and filters. */
  async loadColorOptions(): Promise<void> {
    try {
      const colorOptions = await getAdminColors();
      runInAction(() => {
        this.colorOptions = colorOptions;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load colors.';
      });
    }
  }

  /** Creates a product and refreshes admin product rows. */
  async createProduct(input: CreateAdminProductInput): Promise<AdminProduct | null> {
    this.isSaving = true;
    this.saveError = null;

    try {
      const product = await createAdminProduct(input);
      runInAction(() => {
        this.products = [product, ...this.products.filter((item) => item.id !== product.id)];
      });
      await this.loadProducts();
      return product;
    } catch (error) {
      runInAction(() => {
        this.saveError = extractErrorMessage(error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  /** Loads one product for editing. */
  async loadProduct(id: string): Promise<AdminProduct | null> {
    this.saveError = null;

    try {
      return await getAdminProduct(id);
    } catch (error) {
      runInAction(() => {
        this.saveError = extractErrorMessage(error);
      });
      return null;
    }
  }

  /** Updates a product and refreshes admin product rows. */
  async updateProduct(id: string, input: CreateAdminProductInput): Promise<AdminProduct | null> {
    this.isSaving = true;
    this.saveError = null;

    try {
      const product = await updateAdminProduct(id, input);
      runInAction(() => {
        this.products = this.products.map((item) => (item.id === product.id ? product : item));
      });
      await this.loadProducts();
      return product;
    } catch (error) {
      runInAction(() => {
        this.saveError = extractErrorMessage(error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  /** Clears mutation errors before a new user action. */
  clearSaveError(): void {
    this.saveError = null;
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : 'Unable to save product.';
}
