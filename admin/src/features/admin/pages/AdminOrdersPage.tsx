import { observer } from 'mobx-react-lite';
import { Link, useParams } from 'react-router-dom';
import Select from 'react-select';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminOrderStatus } from '../types';
import { formatDate, formatMoney } from '../utils/formatters';
import { adminPath, normalizeAdminLocale } from '../i18n';

const statusOptions: Array<{ label: AdminOrderStatus; value: AdminOrderStatus }> = [
  { label: 'PendingPayment', value: 'PendingPayment' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
];

export const AdminOrdersPage = observer(function AdminOrdersPage() {
  const { orders } = useAdminStore();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);

  if (orders.isLoading) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading orders..." />
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Orders</h1>
        <p>Review orders and open invoices with payment and customer snapshots.</p>
      </div>

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={adminPath(locale, `orders/${order.id}`)}>
                      <strong>{order.orderNumber}</strong>
                    </Link>
                    <small>{order.itemCount} item(s)</small>
                  </td>
                  <td>{order.customerName}</td>
                  <td>{formatDate(order.createdAtUtc, locale)}</td>
                  <td>{formatMoney(order.totalAmount, locale)}</td>
                  <td><StatusBadge value={order.paymentStatus} /></td>
                  <td>
                    <Select
                      classNamePrefix="admin-select"
                      options={statusOptions}
                      value={statusOptions.find((option) => option.value === order.status)}
                      onChange={(option: { label: AdminOrderStatus; value: AdminOrderStatus } | null) => {
                        if (option) {
                          orders.updateStatus(order.id, option.value);
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
});
