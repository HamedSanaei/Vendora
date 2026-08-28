import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminOrder } from '../types';

/** Synchronizes order search, status filters, and pagination with the current URL. */
export function useAdminOrderQuery(orders: AdminOrder[], pageSize: number) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const payment = searchParams.get('payment') ?? 'all';
  const requestedPage = Number(searchParams.get('page') ?? '1');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesQuery = !normalizedQuery || `${order.orderNumber} ${order.customerName}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesQuery && (status === 'all' || order.status === status) && (payment === 'all' || order.paymentStatus === payment);
    });
  }, [orders, payment, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;

  function updateParam(key: string, value: string, resetPage = true): void {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  }

  return {
    page,
    pageItems: filtered.slice((page - 1) * pageSize, page * pageSize),
    payment,
    query,
    setPage: (value: number) => updateParam('page', String(value), false),
    setPayment: (value: string) => updateParam('payment', value),
    setQuery: (value: string) => updateParam('q', value),
    setStatus: (value: string) => updateParam('status', value),
    status,
    totalItems: filtered.length,
    totalPages,
  };
}
