import { AdminBrandStore } from './AdminBrandStore';
import { AdminAuthStore } from './AdminAuthStore';
import { AdminCategoryStore } from './AdminCategoryStore';
import { AdminColorStore } from './AdminColorStore';
import { AdminCouponStore } from './AdminCouponStore';
import { AdminDashboardStore } from './AdminDashboardStore';
import { AdminNewsletterStore } from './AdminNewsletterStore';
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
  colors = new AdminColorStore();
  coupons = new AdminCouponStore();
  users = new AdminUserStore();
  newsletter = new AdminNewsletterStore();
  dashboard = new AdminDashboardStore();
  ui = new AdminUiStore();

  /** Restores only the current admin identity; feature pages load their own data on demand. */
  async bootstrap(): Promise<void> {
    await this.auth.loadCurrentUser();
  }
}
