import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatDate, formatMoney } from '../utils/formatters';

/** Renders the responsive order, customer, item, and payment snapshot from the order API. */
export const AdminOrderDetailsPage = observer(function AdminOrderDetailsPage() {
  const { orders } = useAdminStore();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const isFa = locale === 'fa';
  const orderId = params.id;

  useEffect(() => {
    if (orderId) void orders.loadOrder(orderId);
  }, [orderId, orders]);

  if (orders.isLoading && !orders.selectedOrder) {
    return <section className="admin-page"><LoadingState label={isFa ? 'در حال دریافت جزئیات سفارش…' : 'Loading order details…'} /></section>;
  }

  const order = orders.selectedOrder;
  if (!order) {
    return <section className="admin-page"><AdminFeedback tone="error">{orders.error ?? (isFa ? 'سفارش پیدا نشد.' : 'Order was not found.')}</AdminFeedback></section>;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'جزئیات سفارش' : 'Order detail'}
        title={`${isFa ? 'سفارش' : 'Order'} ${order.orderNumber}`}
        description={`${formatDate(order.createdAtUtc, locale)} · ${order.items.length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} ${isFa ? 'ردیف کالا' : 'line items'}`}
        actions={<AdminButton icon="arrow" to={adminPath(locale, 'orders')} variant="secondary">{isFa ? 'بازگشت به سفارش‌ها' : 'Back to orders'}</AdminButton>}
      />

      <div className="admin-order-detail-statuses"><StatusBadge locale={locale} value={order.status} /><StatusBadge locale={locale} value={order.paymentStatus} /></div>

      <div className="admin-order-review-grid">
        <AdminPanel title={isFa ? 'مشتری' : 'Customer'}>
          <dl className="admin-detail-list">
            <div><dt>{isFa ? 'نام' : 'Name'}</dt><dd>{order.customer.fullName}</dd></div>
            <div><dt>{isFa ? 'ایمیل' : 'Email'}</dt><dd dir="ltr">{order.customer.email || '—'}</dd></div>
            <div><dt>{isFa ? 'تلفن' : 'Phone'}</dt><dd dir="ltr">{order.customer.phoneNumber || '—'}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel title={isFa ? 'خلاصه مالی' : 'Financial summary'}>
          <dl className="admin-detail-list">
            <div><dt>{isFa ? 'جمع کالاها' : 'Subtotal'}</dt><dd>{formatMoney(order.subtotal, locale)}</dd></div>
            <div><dt>{isFa ? 'ارسال' : 'Shipping'}</dt><dd>{formatMoney(order.shippingCost, locale)}</dd></div>
            <div><dt>{isFa ? 'تخفیف' : 'Discount'}</dt><dd>{formatMoney(order.discountAmount, locale)}</dd></div>
            <div className="admin-detail-total"><dt>{isFa ? 'مبلغ نهایی' : 'Total'}</dt><dd>{formatMoney(order.totalAmount, locale)}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel className="admin-order-shipping" title={isFa ? 'اطلاعات ارسال' : 'Shipping details'}>
          <dl className="admin-detail-list">
            <div><dt>{isFa ? 'گیرنده' : 'Recipient'}</dt><dd>{order.shipping.recipientName || '—'}</dd></div>
            <div><dt>{isFa ? 'تلفن' : 'Phone'}</dt><dd dir="ltr">{order.shipping.phoneNumber || '—'}</dd></div>
            <div><dt>{isFa ? 'استان و شهر' : 'Province and city'}</dt><dd>{[order.shipping.province, order.shipping.city].filter(Boolean).join('، ') || '—'}</dd></div>
            <div><dt>{isFa ? 'نشانی' : 'Address'}</dt><dd>{order.shipping.streetAddress || '—'}</dd></div>
            <div><dt>{isFa ? 'پلاک / واحد' : 'Plaque / Unit'}</dt><dd>{[order.shipping.plaque, order.shipping.unit].filter(Boolean).join(' / ') || '—'}</dd></div>
            <div><dt>{isFa ? 'کد پستی' : 'Postal code'}</dt><dd dir="ltr">{order.shipping.postalCode || '—'}</dd></div>
          </dl>
        </AdminPanel>
      </div>

      <AdminPanel title={isFa ? 'اقلام سفارش' : 'Purchased items'} description={isFa ? 'قیمت‌ها و عنوان‌ها همان snapshot زمان خرید هستند.' : 'Titles and prices are the immutable checkout snapshot.'}>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>{isFa ? 'محصول' : 'Product'}</th><th>{isFa ? 'قیمت واحد' : 'Unit price'}</th><th>{isFa ? 'تعداد' : 'Quantity'}</th><th>{isFa ? 'جمع' : 'Line total'}</th></tr></thead>
          <tbody>{order.items.map((item) => <tr key={`${item.productId}-${item.productTitle}`}><td data-label={isFa ? 'محصول' : 'Product'}>{item.productTitle}</td><td data-label={isFa ? 'قیمت واحد' : 'Unit price'}>{formatMoney(item.unitPrice, locale)}</td><td data-label={isFa ? 'تعداد' : 'Quantity'}>{item.quantity.toLocaleString(isFa ? 'fa-IR' : 'en-US')}</td><td data-label={isFa ? 'جمع' : 'Line total'}>{formatMoney(item.lineTotal, locale)}</td></tr>)}</tbody>
        </table></div>
      </AdminPanel>

      <AdminPanel title={isFa ? 'تراکنش‌های پرداخت' : 'Payment transactions'}>
        {order.payments.length === 0 ? <AdminEmptyState icon="orders" title={isFa ? 'تراکنشی ثبت نشده' : 'No transactions'} description={isFa ? 'پس از شروع پرداخت، اطلاعات درگاه اینجا ثبت می‌شود.' : 'Gateway transaction details appear after payment begins.'} /> : (
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>{isFa ? 'درگاه' : 'Provider'}</th><th>{isFa ? 'شماره مرجع' : 'Reference'}</th><th>{isFa ? 'Authority' : 'Authority'}</th><th>{isFa ? 'مبلغ' : 'Amount'}</th><th>{isFa ? 'وضعیت' : 'Status'}</th></tr></thead>
            <tbody>{order.payments.map((payment) => <tr key={payment.id}><td data-label={isFa ? 'درگاه' : 'Provider'}>{payment.provider}</td><td data-label={isFa ? 'شماره مرجع' : 'Reference'} dir="ltr">{payment.referenceId ?? '—'}</td><td data-label="Authority" dir="ltr">{payment.authority ?? '—'}</td><td data-label={isFa ? 'مبلغ' : 'Amount'}>{formatMoney(payment.amount, locale)}</td><td data-label={isFa ? 'وضعیت' : 'Status'}><StatusBadge locale={locale} value={payment.status} /></td></tr>)}</tbody>
          </table></div>
        )}
      </AdminPanel>
    </section>
  );
});
