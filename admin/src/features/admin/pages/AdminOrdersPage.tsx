import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminConfirmDialog, AdminEmptyState, AdminFeedback, AdminFilterBar, AdminPageHeader, AdminPagination, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminOrderQuery } from '../hooks/useAdminOrderQuery';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminOrder, AdminOrderStatus } from '../types';
import { formatDate, formatMoney } from '../utils/formatters';

const statusLabelsFa: Record<AdminOrderStatus, string> = {
  PendingPayment: 'در انتظار پرداخت', Paid: 'پرداخت‌شده', Processing: 'در حال پردازش', Packed: 'بسته‌بندی‌شده', Shipped: 'ارسال‌شده', Delivered: 'تحویل‌شده', Cancelled: 'لغوشده', Refunded: 'بازپرداخت‌شده',
};

interface PendingTransition {
  order: AdminOrder;
  status: AdminOrderStatus;
}

/** Renders searchable orders and persists only Backend-approved lifecycle transitions. */
export const AdminOrdersPage = observer(function AdminOrdersPage() {
  const { orders } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const list = useAdminOrderQuery(orders.orders, 10);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);

  useEffect(() => {
    void orders.loadOrders();
  }, [orders]);

  async function persistTransition(order: AdminOrder, status: AdminOrderStatus): Promise<void> {
    const succeeded = await orders.updateStatus(order.id, status);
    if (succeeded) toast.success(isFa ? 'وضعیت سفارش با موفقیت ذخیره شد.' : 'Order status saved.');
    else toast.error(orders.error ?? (isFa ? 'ذخیره وضعیت سفارش ناموفق بود.' : 'Unable to save order status.'));
  }

  function requestTransition(order: AdminOrder, status: AdminOrderStatus): void {
    if (status === 'Cancelled' && order.paymentStatus === 'Verified') {
      setPendingTransition({ order, status });
      return;
    }
    void persistTransition(order, status);
  }

  if (orders.isLoading && orders.orders.length === 0) {
    return <section className="admin-page"><LoadingState label={isFa ? 'در حال بارگذاری سفارش‌ها…' : 'Loading orders…'} /></section>;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'عملیات فروش' : 'Sales operations'}
        title={isFa ? 'سفارش‌ها' : 'Orders'}
        description={isFa ? `${list.totalItems.toLocaleString('fa-IR')} سفارش مطابق فیلترهای فعلی` : `${list.totalItems} orders match the current filters`}
      />
      {orders.error ? <AdminFeedback tone="error">{orders.error}</AdminFeedback> : null}

      <AdminPanel>
        <AdminFilterBar searchLabel={isFa ? 'جستجو با شماره سفارش یا نام مشتری…' : 'Search order or customer…'} searchValue={list.query} onSearchChange={list.setQuery}>
          <select aria-label={isFa ? 'وضعیت سفارش' : 'Order status'} className="admin-filter-select" value={list.status} onChange={(event) => list.setStatus(event.target.value)}>
            <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
            {(Object.keys(statusLabelsFa) as AdminOrderStatus[]).map((status) => <option key={status} value={status}>{isFa ? statusLabelsFa[status] : status}</option>)}
          </select>
          <select aria-label={isFa ? 'وضعیت پرداخت' : 'Payment status'} className="admin-filter-select" value={list.payment} onChange={(event) => list.setPayment(event.target.value)}>
            <option value="all">{isFa ? 'همه پرداخت‌ها' : 'All payments'}</option>
            <option value="Verified">{isFa ? 'تأییدشده' : 'Verified'}</option><option value="Pending">{isFa ? 'در انتظار' : 'Pending'}</option><option value="Redirected">{isFa ? 'ارسال به درگاه' : 'Redirected'}</option><option value="Failed">{isFa ? 'ناموفق' : 'Failed'}</option><option value="Cancelled">{isFa ? 'لغوشده' : 'Cancelled'}</option>
          </select>
        </AdminFilterBar>

        {list.pageItems.length === 0 ? (
          <AdminEmptyState icon="orders" title={isFa ? 'سفارشی پیدا نشد' : 'No orders found'} description={isFa ? 'فیلترها را تغییر دهید؛ سفارش‌های جدید پس از ثبت اینجا نمایش داده می‌شوند.' : 'Adjust the filters; new orders appear here after checkout.'} />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{isFa ? 'سفارش' : 'Order'}</th><th>{isFa ? 'مشتری' : 'Customer'}</th><th>{isFa ? 'تاریخ' : 'Date'}</th><th>{isFa ? 'مبلغ' : 'Total'}</th><th>{isFa ? 'پرداخت' : 'Payment'}</th><th>{isFa ? 'مرحله سفارش' : 'Order stage'}</th></tr></thead>
              <tbody>
                {list.pageItems.map((order) => (
                  <tr key={order.id}>
                    <td data-label={isFa ? 'سفارش' : 'Order'}><Link to={adminPath(locale, `orders/${order.id}`)}><strong>{order.orderNumber}</strong></Link><small>{order.itemCount.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'قلم کالا' : 'item(s)'}</small></td>
                    <td data-label={isFa ? 'مشتری' : 'Customer'}>{order.customerName}</td>
                    <td data-label={isFa ? 'تاریخ' : 'Date'}>{formatDate(order.createdAtUtc, locale)}</td>
                    <td data-label={isFa ? 'مبلغ' : 'Total'}>{formatMoney(order.totalAmount, locale)}</td>
                    <td data-label={isFa ? 'پرداخت' : 'Payment'}><StatusBadge locale={locale} value={order.paymentStatus} /></td>
                    <td data-label={isFa ? 'مرحله سفارش' : 'Order stage'}>
                      <div className="admin-order-status-control">
                        <StatusBadge locale={locale} value={order.status} />
                        <select
                          aria-label={isFa ? `تغییر وضعیت ${order.orderNumber}` : `Change status ${order.orderNumber}`}
                          disabled={order.allowedNextStatuses.length === 0 || orders.updatingOrderId === order.id}
                          onChange={(event) => requestTransition(order, event.target.value as AdminOrderStatus)}
                          value=""
                        >
                          <option value="">{order.allowedNextStatuses.length === 0 ? (isFa ? 'مرحله نهایی' : 'Final state') : (isFa ? 'تغییر مرحله…' : 'Change stage…')}</option>
                          {order.allowedNextStatuses.map((status) => <option key={status} value={status}>{isFa ? statusLabelsFa[status] : status}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination currentPage={list.page} label={isFa ? 'صفحه‌بندی سفارش‌ها' : 'Order pagination'} locale={locale} onPageChange={list.setPage} totalPages={list.totalPages} />
      </AdminPanel>

      <AdminConfirmDialog
        cancelLabel={isFa ? 'انصراف' : 'Back'}
        confirmLabel={isFa ? 'لغو سفارش' : 'Cancel order'}
        description={isFa ? 'پرداخت این سفارش تأیید شده است. لغو سفارش وضعیت پرداخت را تغییر نمی‌دهد و بازپرداخت مالی باید جداگانه انجام شود.' : 'This payment is verified. Cancelling the order does not refund the payment; financial settlement remains a separate action.'}
        isOpen={Boolean(pendingTransition)}
        isPending={Boolean(pendingTransition && orders.updatingOrderId === pendingTransition.order.id)}
        onCancel={() => setPendingTransition(null)}
        onConfirm={() => {
          if (!pendingTransition) return;
          void persistTransition(pendingTransition.order, pendingTransition.status).finally(() => setPendingTransition(null));
        }}
        title={isFa ? 'لغو سفارش پرداخت‌شده؟' : 'Cancel paid order?'}
      />
    </section>
  );
});
