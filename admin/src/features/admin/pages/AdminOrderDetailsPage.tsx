import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatDate, formatMoney } from '../utils/formatters';

export const AdminOrderDetailsPage = observer(function AdminOrderDetailsPage() {
  const { orders } = useAdminStore();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const orderId = params.id;

  useEffect(() => {
    if (orderId) {
      void orders.loadOrder(orderId);
    }
  }, [orderId, orders]);

  if (orders.isLoading && !orders.selectedOrder) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading invoice..." />
      </section>
    );
  }

  const order = orders.selectedOrder;
  if (!order) {
    return (
      <section className="admin-page">
        <div className="admin-error">{orders.error ?? 'Order was not found.'}</div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Invoice {order.orderNumber}</h1>
        <p>Snapshot of customer, payment, and purchased items at order time.</p>
      </div>

      <Link className="admin-ghost-btn" to={adminPath(locale, 'orders')}>
        Back to orders
      </Link>

      <article className="admin-panel admin-invoice-grid">
        <div>
          <h3>Customer</h3>
          <p><strong>{order.customer.fullName}</strong></p>
          <p>{order.customer.email || '-'}</p>
          <p>{order.customer.phoneNumber || '-'}</p>
        </div>
        <div>
          <h3>Order</h3>
          <p>{formatDate(order.createdAtUtc, locale)}</p>
          <p><StatusBadge value={order.status} /></p>
          <p><StatusBadge value={order.paymentStatus} /></p>
        </div>
        <div>
          <h3>Totals</h3>
          <p>Subtotal: {formatMoney(order.subtotal, locale)}</p>
          <p>Shipping: {formatMoney(order.shippingCost, locale)}</p>
          <p>Discount: {formatMoney(order.discountAmount, locale)}</p>
          <p><strong>Total: {formatMoney(order.totalAmount, locale)}</strong></p>
        </div>
      </article>

      <article className="admin-panel">
        <h3>Purchased cart snapshot</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit price</th>
                <th>Qty</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.productId}-${item.productTitle}`}>
                  <td>{item.productTitle}</td>
                  <td>{formatMoney(item.unitPrice, locale)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.lineTotal, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="admin-panel">
        <h3>Payments</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Reference</th>
                <th>Authority</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.provider}</td>
                  <td>{payment.referenceId ?? '-'}</td>
                  <td>{payment.authority ?? '-'}</td>
                  <td>{formatMoney(payment.amount, locale)}</td>
                  <td><StatusBadge value={payment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
});
