import { makeAutoObservable, runInAction } from 'mobx';
import { getAdminOrder, getAdminOrders } from '../api/adminApi';
import type { AdminOrder, AdminOrderDetails, AdminOrderStatus } from '../types';

export class AdminOrderStore {
  orders: AdminOrder[] = [];
  selectedOrder: AdminOrderDetails | null = null;
  isLoading = false;
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

  /** Updates a local order status during the UI-first admin stage. */
  updateStatus(orderId: string, status: AdminOrderStatus): void {
    const order = this.orders.find((item) => item.id === orderId);
    if (order) {
      order.status = status;
    }
  }
}
