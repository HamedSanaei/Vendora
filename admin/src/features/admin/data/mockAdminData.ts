import type { AdminBrand, AdminCategory, AdminCoupon, AdminOrder, AdminStaff } from '../types';

export const mockCategories: AdminCategory[] = [
  { id: 'cat-handbags', name: 'Handbags', slug: 'handbags', parentCategoryId: null, parentCategoryName: null, productCount: 5, isActive: true },
  { id: 'cat-backpacks', name: 'Backpacks', slug: 'backpacks', parentCategoryId: null, parentCategoryName: null, productCount: 4, isActive: true },
  { id: 'cat-travel', name: 'Travel Bags', slug: 'travel-bags', parentCategoryId: null, parentCategoryName: null, productCount: 3, isActive: true },
  { id: 'cat-work', name: 'Work Bags', slug: 'work-bags', parentCategoryId: null, parentCategoryName: null, productCount: 2, isActive: true },
];

export const mockOrders: AdminOrder[] = [
  {
    id: 'order-seed-1',
    orderNumber: 'ORD-SEED-0001',
    customerName: 'Test Customer',
    createdAtUtc: '2026-06-12T10:20:00Z',
    totalAmount: 1350000,
    status: 'Paid',
    paymentStatus: 'Verified',
    itemCount: 1,
  },
  {
    id: 'order-seed-2',
    orderNumber: 'ORD-SEED-0002',
    customerName: 'Sara Ahmadi',
    createdAtUtc: '2026-06-14T16:45:00Z',
    totalAmount: 2480000,
    status: 'Processing',
    paymentStatus: 'Verified',
    itemCount: 2,
  },
  {
    id: 'order-seed-3',
    orderNumber: 'ORD-SEED-0003',
    customerName: 'Ali Rezaei',
    createdAtUtc: '2026-06-16T08:30:00Z',
    totalAmount: 980000,
    status: 'PendingPayment',
    paymentStatus: 'Pending',
    itemCount: 1,
  },
  {
    id: 'order-seed-4',
    orderNumber: 'ORD-SEED-0004',
    customerName: 'Mina Karimi',
    createdAtUtc: '2026-06-17T12:10:00Z',
    totalAmount: 3120000,
    status: 'Shipped',
    paymentStatus: 'Verified',
    itemCount: 3,
  },
];

export const mockBrands: AdminBrand[] = [
  {
    id: 'brand-vendora',
    name: 'Vendora',
    slug: 'vendora',
    logoUrl: null,
    email: null,
    website: null,
    description: null,
    location: null,
    productCount: 12,
    isActive: true,
  },
  {
    id: 'brand-studio',
    name: 'Studio Line',
    slug: 'studio-line',
    logoUrl: null,
    email: null,
    website: null,
    description: null,
    location: null,
    productCount: 4,
    isActive: true,
  },
];

export const mockCoupons: AdminCoupon[] = [
  {
    id: 'coupon-summer',
    title: 'Summer Sale',
    code: 'SUMMER10',
    discountPercent: 10,
    maxDiscountAmount: 150000,
    expiresAtUtc: '2026-08-31T00:00:00Z',
    isActive: true,
    appliesToAllCategories: true,
    categoryIds: [],
    categoryNames: [],
  },
  {
    id: 'coupon-vip',
    title: 'VIP Discount',
    code: 'VIP15',
    discountPercent: 15,
    maxDiscountAmount: 250000,
    expiresAtUtc: '2026-09-30T00:00:00Z',
    isActive: true,
    appliesToAllCategories: true,
    categoryIds: [],
    categoryNames: [],
  },
];

export const mockStaff: AdminStaff[] = [
  { id: 'staff-owner', name: 'Vendora Admin', email: 'admin@vendora.local', role: 'Owner' },
  { id: 'staff-manager', name: 'Store Manager', email: 'manager@vendora.local', role: 'Manager' },
];
