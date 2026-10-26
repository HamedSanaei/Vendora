import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminProduct } from '../types';
import { normalizeProductSort, sortAdminProducts, type ProductSort } from '../utils/product-sort';
import { normalizeDigits } from '../utils/formatters';

interface AdminProductQueryResult {
  category: string;
  page: number;
  pageItems: AdminProduct[];
  query: string;
  setCategory: (value: string) => void;
  setPage: (value: number) => void;
  setQuery: (value: string) => void;
  setStatus: (value: string) => void;
  status: string;
  sort: ProductSort;
  setSort: (value: string) => void;
  totalItems: number;
  totalPages: number;
}

/** Synchronizes product search, filters, and pagination with the route query string. */
export function useAdminProductQuery(products: AdminProduct[], pageSize: number, locale: 'fa' | 'en' = 'fa'): AdminProductQueryResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const sort = normalizeProductSort(searchParams.get('sort'));
  const requestedPage = Number(searchParams.get('page') ?? '1');

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeDigits(query.trim()).toLocaleLowerCase();
    return sortAdminProducts(products.filter((product) => {
      const matchesQuery = !normalizedQuery || String(product.productCode) === normalizedQuery || normalizeDigits(`${product.title} ${product.slug} ${product.brandName ?? ''}`).toLocaleLowerCase().includes(normalizedQuery);
      const matchesCategory = category === 'all' || product.categoryIds.includes(category) || product.categoryId === category;
      const matchesStatus = status === 'all' || product.status === status || product.inventoryStatus === status;
      return matchesQuery && matchesCategory && matchesStatus;
    }), sort, normalizedQuery, locale);
  }, [category, products, query, status, sort, locale]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  function updateParam(key: string, value: string, resetPage = true): void {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  }

  return {
    category,
    page,
    pageItems,
    query,
    setCategory: (value) => updateParam('category', value),
    setPage: (value) => updateParam('page', String(value), false),
    setQuery: (value) => updateParam('q', value),
    setStatus: (value) => updateParam('status', value),
    status,
    sort,
    setSort: (value) => updateParam('sort', normalizeProductSort(value)),
    totalItems: filtered.length,
    totalPages,
  };
}
