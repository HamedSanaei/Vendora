import { AdminBrandStore } from './AdminBrandStore';
import { AdminAuthStore } from './AdminAuthStore';
import { AdminCategoryStore } from './AdminCategoryStore';
import { AdminCouponStore } from './AdminCouponStore';
import { AdminDashboardStore } from './AdminDashboardStore';
import { AdminOrderStore } from './AdminOrderStore';
import { AdminProductStore } from './AdminProductStore';
import { AdminUiStore } from './AdminUiStore';
import { AdminUserStore } from './AdminUserStore';

export class AdminRootStore {
  auth = new AdminAuthStore();
  products = new AdminProductStore();
  orders = new AdminOrderStore();
  categories = new AdminCategoryStore();
  brands = new AdminBrandStore();
  coupons = new AdminCouponStore();
  users = new AdminUserStore();
  dashboard = new AdminDashboardStore();
  ui = new AdminUiStore();

  /** Loads the shared admin data needed by dashboard and tables. */
  async bootstrap(): Promise<void> {
    await this.auth.loadCurrentUser();
    if (!this.auth.isAdmin) {
      return;
    }

    await Promise.all([
      this.products.loadProducts(),
      this.products.loadCategoryOptions(),
      this.products.loadColorOptions(),
      this.orders.loadOrders(),
      this.categories.loadCategories(),
      this.brands.loadBrands(),
      this.coupons.loadCoupons(),
      this.users.loadUsers(),
    ]);
    await Promise.all([
      this.dashboard.loadDashboard(this.products.products, this.orders.orders),
    ]);
  }
}
