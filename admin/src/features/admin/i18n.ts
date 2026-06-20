export type AdminLocale = 'fa' | 'en';

export const defaultAdminLocale: AdminLocale = 'fa';

export const adminMessages = {
  fa: {
    dashboard: 'داشبورد',
    products: 'محصولات',
    productList: 'لیست محصولات',
    productGrid: 'گرید محصولات',
    addProduct: 'افزودن محصول',
    editProduct: 'ویرایش محصول',
    category: 'دسته‌بندی',
    orders: 'سفارش‌ها',
    brand: 'برند',
    coupons: 'کدهای تخفیف',
    profile: 'کاربران',
    onlineStore: 'فروشگاه آنلاین',
    staff: 'تیم',
    pages: 'صفحات',
    register: 'ثبت‌نام',
    login: 'ورود',
    forgotPassword: 'فراموشی رمز',
    logout: 'خروج',
    menu: 'منو',
    search: 'جستجو...',
    save: 'ذخیره',
    saving: 'در حال ذخیره...',
    cancel: 'انصراف',
    edit: 'ویرایش',
    delete: 'حذف',
    add: 'افزودن',
    active: 'فعال',
    inactive: 'غیرفعال',
    draft: 'پیش‌نویس',
    archived: 'آرشیو',
    toman: 'تومان',
  },
  en: {
    dashboard: 'Dashboard',
    products: 'Products',
    productList: 'Product List',
    productGrid: 'Product Grid',
    addProduct: 'Add Product',
    editProduct: 'Edit Product',
    category: 'Category',
    orders: 'Orders',
    brand: 'Brand',
    coupons: 'Coupons',
    profile: 'Users',
    onlineStore: 'Online store',
    staff: 'Our Staff',
    pages: 'Pages',
    register: 'Register',
    login: 'Login',
    forgotPassword: 'Forgot Password',
    logout: 'Logout',
    menu: 'Menu',
    search: 'Search here...',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add',
    active: 'Active',
    inactive: 'Inactive',
    draft: 'Draft',
    archived: 'Archived',
    toman: 'Toman',
  },
} as const;

export type AdminMessageKey = keyof typeof adminMessages.en;

/** Returns a supported locale from a route parameter. */
export function normalizeAdminLocale(locale: string | undefined): AdminLocale {
  return locale === 'en' || locale === 'fa' ? locale : defaultAdminLocale;
}

/** Builds locale-prefixed admin routes. */
export function adminPath(locale: AdminLocale, path = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}/admin${cleanPath === '/' ? '' : cleanPath}`;
}

/** Returns localized admin UI text. */
export function adminText(locale: AdminLocale, key: AdminMessageKey): string {
  return adminMessages[locale][key];
}
