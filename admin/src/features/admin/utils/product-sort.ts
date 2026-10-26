import type { AdminProduct } from '../types';

export const productSortOptions = [
  { value: 'newest', fa: 'جدیدترین محصولات', en: 'Newest first' },
  { value: 'oldest', fa: 'قدیمی‌ترین محصولات', en: 'Oldest first' },
  { value: 'updated', fa: 'آخرین ویرایش', en: 'Recently updated' },
  { value: 'price-asc', fa: 'قیمت: کم به زیاد', en: 'Price: low to high' },
  { value: 'price-desc', fa: 'قیمت: زیاد به کم', en: 'Price: high to low' },
  { value: 'stock-asc', fa: 'موجودی: کم به زیاد', en: 'Stock: low to high' },
  { value: 'stock-desc', fa: 'موجودی: زیاد به کم', en: 'Stock: high to low' },
  { value: 'name', fa: 'نام محصول: الفبایی', en: 'Product name' },
] as const;
export type ProductSort = typeof productSortOptions[number]['value'];

/** Treats unknown URL values as the stable newest-first default. */
export function normalizeProductSort(value: string | null): ProductSort {
  return productSortOptions.some(option => option.value === value) ? value as ProductSort : 'newest';
}

/** Parses server UTC timestamps; missing/invalid historical dates stay last rather than becoming a fabricated date. */
function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const date = Date.parse(value); return Number.isFinite(date) ? date : null;
}

/** Sorts valid dates in the requested direction while always keeping unavailable timestamps last. */
function dates(a: number | null, b: number | null, ascending: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return ascending ? a - b : b - a;
}

/** Sorts a copy before pagination, preserving exact-code search priority and deterministic ties without mutating MobX data. */
export function sortAdminProducts(products: AdminProduct[], sort: ProductSort, exactCode = '', locale: 'fa' | 'en' = 'fa'): AdminProduct[] {
  const names = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return [...products].sort((a, b) => {
    const match = Number(Boolean(exactCode) && String(b.productCode) === exactCode) - Number(Boolean(exactCode) && String(a.productCode) === exactCode);
    if (match) return match;
    let difference = 0;
    switch (sort) {
      case 'newest': case 'oldest': difference = dates(timestamp(a.createdAtUtc), timestamp(b.createdAtUtc), sort === 'oldest'); break;
      case 'updated': difference = dates(timestamp(a.updatedAtUtc) ?? timestamp(a.createdAtUtc), timestamp(b.updatedAtUtc) ?? timestamp(b.createdAtUtc), false); break;
      case 'price-asc': difference = a.price - b.price; break;
      case 'price-desc': difference = b.price - a.price; break;
      case 'stock-asc': difference = a.stockQuantity - b.stockQuantity; break;
      case 'stock-desc': difference = b.stockQuantity - a.stockQuantity; break;
      case 'name': difference = names.compare(a.title, b.title); break;
    }
    return difference || b.productCode - a.productCode || a.id.localeCompare(b.id);
  });
}
