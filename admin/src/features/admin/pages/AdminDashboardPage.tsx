import { observer } from 'mobx-react-lite';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { LoadingState } from '../components/LoadingState';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatDate, formatMoney } from '../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export const AdminDashboardPage = observer(function AdminDashboardPage() {
  const { dashboard, orders } = useAdminStore();
  const stats = dashboard.stats;

  if (dashboard.isLoading || orders.isLoading || !stats) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading dashboard..." />
      </section>
    );
  }

  const chartData = {
    labels: stats.monthlySales.map((item) => item.month),
    datasets: [
      {
        label: 'Sales',
        data: stats.monthlySales.map((item) => item.amount),
        borderColor: '#0989FF',
        backgroundColor: 'rgba(9, 137, 255, 0.14)',
        fill: true,
        tension: 0.38,
      },
    ],
  };

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Dashboard</h1>
        <p>Welcome to your Vendora admin dashboard</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard title="Total Sales" value={formatMoney(stats.totalSales)} tone="blue" />
        <StatCard title="Orders" value={stats.totalOrders.toString()} tone="green" />
        <StatCard title="Products" value={stats.totalProducts.toString()} tone="purple" />
        <StatCard title="Customers" value={stats.totalCustomers.toString()} tone="rose" />
      </div>

      <div className="admin-dashboard-grid">
        <article className="admin-panel">
          <div className="admin-panel-head">
            <h2>Sales Report</h2>
            <span>Last 6 months</span>
          </div>
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { ticks: { callback: (value: string | number) => formatMoney(Number(value)) } },
              },
            }}
          />
        </article>

        <article className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent Orders</h2>
            <span>UI-first data</span>
          </div>
          <div className="admin-list">
            {orders.orders.slice(0, 4).map((order) => (
              <div className="admin-list-row" key={order.id}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <small>{order.customerName} - {formatDate(order.createdAtUtc)}</small>
                </div>
                <div className="admin-list-end">
                  <span>{formatMoney(order.totalAmount)}</span>
                  <StatusBadge value={order.status} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
});
