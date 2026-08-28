import { makeAutoObservable, runInAction } from 'mobx';
import { changeAdminOrderStatus, getAdminOrder, getAdminOrders } from '../api/adminApi';
import type { AdminOrder, AdminOrderDetails, AdminOrderStatus } from '../types';

export class AdminOrderStore {
  orders: AdminOrder[] = [];
  selectedOrder: AdminOrderDetails | null = null;
  isLoading = false;
  updatingOrderId: string | null = null;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Loads one order invoice for the details page. */
  async loadOrder(id: string): Promise<AdminOrderDetails | null> {
    this.isLoading = true;
    this.error = null;

    try {
      const order = await getAdminOrder(id);
      runInAction(() => {
        this.selectedOrder = order;
      });
      return order;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load order.';
      });
      return null;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Loads orders for admin order and dashboard screens. */
  async loadOrders(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const orders = await getAdminOrders();
      runInAction(() => {
        this.orders = orders;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unable to load orders.';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Persists a guarded order lifecycle transition and synchronizes every visible order copy. */
  async updateStatus(orderId: string, status: AdminOrderStatus): Promise<boolean> {
    this.updatingOrderId = orderId;
    this.error = null;

    try {
      const update = await changeAdminOrderStatus(orderId, status);
      runInAction(() => {
        const order = this.orders.find((item) => item.id === orderId);
        if (order) {
          order.status = update.status;
          order.allowedNextStatuses = update.allowedNextStatuses;
        }

        if (this.selectedOrder?.id === orderId) {
          this.selectedOrder.status = update.status;
          this.selectedOrder.allowedNextStatuses = update.allowedNextStatuses;
        }
      });
      return true;
    } catch (error) {
      runInAction(() => {
        this.error = extractErrorMessage(error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.updatingOrderId = null;
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

  return error instanceof Error ? error.message : 'Unable to update the order status.';
}
