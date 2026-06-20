import { httpClient } from '../../../lib/api/httpClient';
import type {
  AdminBrand,
  AdminBrandInput,
  AdminCategory,
  AdminCategoryOption,
  AdminCategoryInput,
  AdminCoupon,
  AdminCouponInput,
  AdminCatalogColor,
  AdminDashboardStats,
  AdminOrder,
  AdminOrderDetails,
  AdminProduct,
  AdminProductDto,
  AdminUser,
  AdminUserInput,
  AdminAuthAccount,
  AdminAuthProfile,
  CreateAdminProductInput,
} from '../types';

const fallbackImageUrl = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80';
const apiBaseUrl = (httpClient.defaults.baseURL ?? '').replace(/\/$/, '');
const multipartRequestConfig = {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
};

function mapProduct(product: AdminProductDto): AdminProduct {
  const sortedImages = [...(product.images ?? [])].sort((first, second) => first.sortOrder - second.sortOrder);
  const imageUrls = sortedImages.map((image) => resolveImageUrl(image.imageUrl));
  const primaryImageUrl = resolveImageUrl(product.primaryImageUrl ?? sortedImages[0]?.imageUrl ?? null);
  const productCategories = product.categories ?? [];
  const primaryCategory = productCategories[0];

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    price: product.price,
    stockQuantity: product.stockQuantity,
    categoryId: primaryCategory?.id ?? product.categoryId,
    categoryIds: productCategories.map((category) => category.id),
    categoryName: primaryCategory?.name ?? product.categoryName ?? 'Uncategorized',
    categories: productCategories,
    brandId: product.brandId,
    brandName: product.brandName,
    imageUrl: primaryImageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : [primaryImageUrl],
    images: sortedImages.map((image) => ({ ...image, imageUrl: resolveImageUrl(image.imageUrl) })),
    colors: product.colors ?? [],
    status: product.status === 'Archived' ? 'Archived' : product.status === 'Active' ? 'Active' : 'Draft',
    inventoryStatus: product.inventoryStatus === 'OutOfStock'
      ? 'OutOfStock'
      : product.inventoryStatus === 'LowStock'
        ? 'LowStock'
        : 'InStock',
  };
}

/** Loads products from the ASP.NET Core API and maps them to the admin UI model. */
export async function getAdminProducts(): Promise<AdminProduct[]> {
  const response = await httpClient.get<AdminProductDto[]>('/api/admin/products');
  return response.data.map(mapProduct);
}

/** Loads real category options from the ASP.NET Core admin API. */
export async function getAdminCategoryOptions(): Promise<AdminCategoryOption[]> {
  const response = await httpClient.get<AdminCategoryOption[]>('/api/admin/categories');
  return response.data;
}

/** Creates a product using the ASP.NET Core multipart admin API. */
export async function createAdminProduct(input: CreateAdminProductInput): Promise<AdminProduct> {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('slug', input.slug ?? '');
  formData.append('description', input.description ?? '');
  formData.append('price', input.price.toString());
  formData.append('stockQuantity', input.stockQuantity.toString());
  formData.append('status', input.status);

  if (input.categoryId) {
    formData.append('categoryId', input.categoryId);
  }

  for (const categoryId of input.categoryIds) {
    formData.append('categoryIds', categoryId);
  }

  if (input.brandId) {
    formData.append('brandId', input.brandId);
  }

  for (const colorId of input.colorIds) {
    formData.append('colorIds', colorId);
  }

  for (const image of input.images) {
    formData.append('images', image);
  }

  if (input.primaryNewImageIndex !== undefined) {
    formData.append('primaryNewImageIndex', input.primaryNewImageIndex.toString());
  }

  const response = await httpClient.post<AdminProductDto>('/api/admin/products', formData, multipartRequestConfig);

  return mapProduct(response.data);
}

/** Loads one product for editing. */
export async function getAdminProduct(id: string): Promise<AdminProduct> {
  const response = await httpClient.get<AdminProductDto>(`/api/admin/products/${id}`);
  return mapProduct(response.data);
}

/** Updates a product using the ASP.NET Core multipart admin API. */
export async function updateAdminProduct(id: string, input: CreateAdminProductInput): Promise<AdminProduct> {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('slug', input.slug ?? '');
  formData.append('description', input.description ?? '');
  formData.append('price', input.price.toString());
  formData.append('stockQuantity', input.stockQuantity.toString());
  formData.append('status', input.status);

  if (input.categoryId) {
    formData.append('categoryId', input.categoryId);
  }

  for (const categoryId of input.categoryIds) {
    formData.append('categoryIds', categoryId);
  }

  if (input.brandId) {
    formData.append('brandId', input.brandId);
  }

  for (const colorId of input.colorIds) {
    formData.append('colorIds', colorId);
  }

  for (const deletedImageId of input.deletedImageIds ?? []) {
    formData.append('deletedImageIds', deletedImageId);
  }

  if (input.primaryImageId) {
    formData.append('primaryImageId', input.primaryImageId);
  }

  if (input.primaryNewImageIndex !== undefined) {
    formData.append('primaryNewImageIndex', input.primaryNewImageIndex.toString());
  }

  for (const image of input.images) {
    formData.append('images', image);
  }

  const response = await httpClient.put<AdminProductDto>(`/api/admin/products/${id}`, formData, multipartRequestConfig);
  return mapProduct(response.data);
}

/** Loads active color options from the catalog API for admin product forms. */
export async function getAdminColors(): Promise<AdminCatalogColor[]> {
  const response = await httpClient.get<AdminCatalogColor[]>('/api/catalog/colors');
  return response.data;
}

function resolveImageUrl(imageUrl: string | null): string {
  if (!imageUrl) {
    return fallbackImageUrl;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

/** Loads categories for the admin UI. */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const response = await httpClient.get<AdminCategory[]>('/api/admin/categories/manage');
  return response.data;
}

/** Creates a category. */
export async function createAdminCategory(input: AdminCategoryInput): Promise<AdminCategory> {
  const response = await httpClient.post<AdminCategory>('/api/admin/categories', input);
  return response.data;
}

/** Updates a category. */
export async function updateAdminCategory(id: string, input: AdminCategoryInput): Promise<AdminCategory> {
  const response = await httpClient.put<AdminCategory>(`/api/admin/categories/${id}`, input);
  return response.data;
}

/** Soft deletes a category. */
export async function deleteAdminCategory(id: string): Promise<void> {
  await httpClient.delete(`/api/admin/categories/${id}`);
}

/** Loads brands. */
export async function getAdminBrands(): Promise<AdminBrand[]> {
  const response = await httpClient.get<AdminBrand[]>('/api/admin/brands');
  return response.data.map((brand) => ({ ...brand, productCount: 0 }));
}

/** Creates a brand. */
export async function createAdminBrand(input: AdminBrandInput): Promise<AdminBrand> {
  const response = await httpClient.post<AdminBrand>('/api/admin/brands', input);
  return { ...response.data, productCount: 0 };
}

/** Updates a brand. */
export async function updateAdminBrand(id: string, input: AdminBrandInput): Promise<AdminBrand> {
  const response = await httpClient.put<AdminBrand>(`/api/admin/brands/${id}`, input);
  return { ...response.data, productCount: 0 };
}

/** Soft deletes a brand. */
export async function deleteAdminBrand(id: string): Promise<void> {
  await httpClient.delete(`/api/admin/brands/${id}`);
}

/** Loads coupons. */
export async function getAdminCoupons(): Promise<AdminCoupon[]> {
  const response = await httpClient.get<AdminCoupon[]>('/api/admin/coupons');
  return response.data;
}

/** Creates a coupon. */
export async function createAdminCoupon(input: AdminCouponInput): Promise<AdminCoupon> {
  const response = await httpClient.post<AdminCoupon>('/api/admin/coupons', input);
  return response.data;
}

/** Updates a coupon. */
export async function updateAdminCoupon(id: string, input: AdminCouponInput): Promise<AdminCoupon> {
  const response = await httpClient.put<AdminCoupon>(`/api/admin/coupons/${id}`, input);
  return response.data;
}

/** Soft deletes a coupon. */
export async function deleteAdminCoupon(id: string): Promise<void> {
  await httpClient.delete(`/api/admin/coupons/${id}`);
}

/** Loads users. */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await httpClient.get<AdminUser[]>('/api/admin/users');
  return response.data;
}

/** Updates a user. */
export async function updateAdminUser(id: string, input: AdminUserInput): Promise<AdminUser> {
  const response = await httpClient.put<AdminUser>(`/api/admin/users/${id}`, input);
  return response.data;
}

/** Requests a password reset placeholder action. */
export async function requestAdminPasswordReset(id: string): Promise<string> {
  try {
    await httpClient.post(`/api/admin/users/${id}/password-reset`);
    return 'Password reset requested.';
  } catch (error) {
    return extractErrorMessage(error);
  }
}

/** Loads orders for the admin UI using local mock data in the UI-first stage. */
export async function getAdminOrders(): Promise<AdminOrder[]> {
  const response = await httpClient.get<AdminOrder[]>('/api/admin/orders');
  return response.data;
}

/** Loads one admin order invoice. */
export async function getAdminOrder(id: string): Promise<AdminOrderDetails> {
  const response = await httpClient.get<AdminOrderDetails>(`/api/admin/orders/${id}`);
  return response.data;
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

/** Creates dashboard totals from the available API and local UI-first data. */
export async function getAdminDashboard(products: AdminProduct[], orders: AdminOrder[]): Promise<AdminDashboardStats> {
  const totalSales = orders
    .filter((order) => order.paymentStatus === 'Verified')
    .reduce((sum, order) => sum + order.totalAmount, 0);

  return {
    totalSales,
    totalOrders: orders.length,
    totalProducts: products.length,
    totalCustomers: 3,
    monthlySales: [
      { month: 'Jan', amount: 720000 },
      { month: 'Feb', amount: 1120000 },
      { month: 'Mar', amount: 980000 },
      { month: 'Apr', amount: 1740000 },
      { month: 'May', amount: 2100000 },
      { month: 'Jun', amount: totalSales },
    ],
  };
}

/** Logs an admin user in through the ASP.NET Core account API. */
export async function loginAdmin(email: string, password: string): Promise<AdminAuthAccount> {
  const response = await httpClient.post<AdminAuthAccount>('/api/account/login', { email, password });
  return response.data;
}

/** Registers an admin user when the configured invite code is valid. */
export async function registerAdmin(input: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  inviteCode: string;
}): Promise<AdminAuthAccount> {
  const response = await httpClient.post<AdminAuthAccount>('/api/admin/account/register', input);
  return response.data;
}

/** Loads the current authenticated admin profile. */
export async function getAdminMe(): Promise<AdminAuthProfile> {
  const response = await httpClient.get<AdminAuthProfile>('/api/account/me');
  return response.data;
}

/** Requests a password reset token for development-stage password recovery. */
export async function forgotAdminPassword(email: string): Promise<{ message: string; resetToken?: string }> {
  const response = await httpClient.post<{ message: string; resetToken?: string }>('/api/account/forgot-password', { email });
  return response.data;
}

/** Resets an admin password with an Identity reset token. */
export async function resetAdminPassword(email: string, token: string, newPassword: string): Promise<void> {
  await httpClient.post('/api/account/reset-password', { email, token, newPassword });
}
