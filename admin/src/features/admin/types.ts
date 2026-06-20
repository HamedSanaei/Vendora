export type AdminInventoryStatus = 'InStock' | 'LowStock' | 'OutOfStock';

export type AdminOrderStatus = 'PendingPayment' | 'Paid' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface PublicProductDto {
  id: string;
  title: string;
  slug: string;
  price: number;
  stockQuantity: number;
  categoryName: string | null;
  primaryImageUrl: string | null;
}

export interface AdminProductDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  status: string;
  inventoryStatus: string;
  categoryId: string | null;
  categoryName: string | null;
  categories: AdminProductCategory[];
  brandId: string | null;
  brandName: string | null;
  primaryImageUrl: string | null;
  images: AdminProductImageDto[];
  colors: AdminCatalogColor[];
}

export interface AdminProductCategory {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
}

export interface AdminProductImageDto {
  id: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  categoryId: string | null;
  categoryIds: string[];
  categoryName: string;
  categories: AdminProductCategory[];
  brandId: string | null;
  brandName: string | null;
  imageUrl: string;
  imageUrls: string[];
  images: AdminProductImage[];
  colors: AdminCatalogColor[];
  status: 'Active' | 'Draft' | 'Archived';
  inventoryStatus: AdminInventoryStatus;
}

export interface AdminProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AdminCategoryOption {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  productCount: number;
  isActive: boolean;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAtUtc: string;
  totalAmount: number;
  status: AdminOrderStatus;
  paymentStatus: 'Pending' | 'Verified' | 'Failed';
  itemCount: number;
}

export interface AdminOrderDetails {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentStatus: 'Pending' | 'Verified' | 'Failed';
  currencyCode: string;
  createdAtUtc: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  customer: {
    id: string | null;
    fullName: string;
    email: string;
    phoneNumber: string | null;
  };
  items: Array<{
    productId: string;
    productTitle: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    authority: string | null;
    referenceId: string | null;
    amount: number;
    status: string;
    failureReason: string | null;
  }>;
}

export interface AdminDashboardStats {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  monthlySales: Array<{ month: string; amount: number }>;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  location: string | null;
  productCount: number;
  isActive: boolean;
}

export interface AdminCoupon {
  id: string;
  title: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number | null;
  expiresAtUtc: string;
  isActive: boolean;
  appliesToAllCategories: boolean;
  categoryIds: string[];
  categoryNames: string[];
}

export interface AdminStaff {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Manager';
}

export interface CreateAdminProductInput {
  title: string;
  slug?: string;
  description?: string;
  price: number;
  stockQuantity: number;
  categoryId?: string;
  categoryIds: string[];
  brandId?: string;
  colorIds: string[];
  status: 'Draft' | 'Active' | 'Archived';
  images: File[];
  deletedImageIds?: string[];
  primaryImageId?: string;
  primaryNewImageIndex?: number;
}

export interface AdminCategoryInput {
  name: string;
  slug?: string;
  parentCategoryId?: string;
  isActive: boolean;
}

export interface AdminCatalogColor {
  id: string;
  name: string;
  slug: string;
  hexCode: string | null;
}

export interface AdminBrandInput {
  name: string;
  slug?: string;
  logoUrl?: string;
  email?: string;
  website?: string;
  description?: string;
  location?: string;
  isActive: boolean;
}

export interface AdminCouponInput {
  title: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount?: number | null;
  expiresAtUtc: string;
  isActive: boolean;
  appliesToAllCategories: boolean;
  categoryIds: string[];
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: 'Customer' | 'Admin';
}

export interface AdminUserInput {
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: 'Customer' | 'Admin';
}

export interface AdminAuthAccount {
  id: string;
  fullName: string;
  email: string;
  role: 'Customer' | 'Admin';
  token: string;
}

export interface AdminAuthProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'Customer' | 'Admin';
}
