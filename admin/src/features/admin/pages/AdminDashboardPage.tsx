import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
import { AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatDate, formatMoney } from '../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

/** Renders real persisted commerce metrics in the responsive Penpot dashboard composition. */
export const AdminDashboardPage = observer(function AdminDashboardPage() {
  const { dashboard } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';

  useEffect(() => {
    void dashboard.loadDashboard();
  }, [dashboard]);

  if (dashboard.isLoading && !dashboard.stats) {
    return <section className="admin-page"><LoadingState label={isFa ? 'در حال بارگذاری داشبورد…' : 'Loading dashboard…'} /></section>;
  }

  if (dashboard.error) {
    return (
      <section className="admin-page">
        <AdminPageHeader title={isFa ? 'داشبورد' : 'Dashboard'} description={isFa ? 'نمای کلی عملکرد واقعی فروشگاه وندورا' : 'A real overview of Vendora commerce operations'} />
        <AdminFeedback tone="error">{dashboard.error}</AdminFeedback>
      </section>
    );
  }

  const stats = dashboard.stats;
  if (!stats) return null;

  const monthFormatter = new Intl.DateTimeFormat(isFa ? 'fa-IR' : 'en-US', { month: 'short' });
  const chartData = {
    labels: stats.monthlySales.map((item) => monthFormatter.format(new Date(Date.UTC(item.year, item.month - 1, 1)))),
    datasets: [
      {
        label: isFa ? 'فروش' : 'Sales',
        data: stats.monthlySales.map((item) => item.amount),
        borderColor: '#8D6B36',
        backgroundColor: 'rgba(184, 149, 85, 0.16)',
        pointBackgroundColor: '#B89555',
        pointBorderColor: '#FCFBF8',
        pointBorderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.38,
      },
    ],
  };

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'مرکز فرماندهی فروشگاه' : 'Commerce command centre'}
        title={isFa ? 'داشبورد' : 'Dashboard'}
        description={isFa ? 'فروش، سفارش‌ها، محصولات و مشتریان را در یک نمای دقیق دنبال کنید.' : 'Track sales, orders, products, and customers in one precise view.'}
      />

      <div className="admin-stats-grid">
        <StatCard title={isFa ? 'فروش تأییدشده' : 'Verified sales'} value={formatMoney(stats.totalSales, locale)} tone="blue" />
        <StatCard title={isFa ? 'کل سفارش‌ها' : 'Orders'} value={stats.totalOrders.toLocaleString(isFa ? 'fa-IR' : 'en-US')} tone="green" />
        <StatCard title={isFa ? 'محصولات' : 'Products'} value={stats.totalProducts.toLocaleString(isFa ? 'fa-IR' : 'en-US')} tone="purple" />
        <StatCard title={isFa ? 'مشتریان' : 'Customers'} value={stats.totalCustomers.toLocaleString(isFa ? 'fa-IR' : 'en-US')} tone="rose" />
      </div>

      <div className="admin-dashboard-grid">
        <AdminPanel title={isFa ? 'گزارش فروش' : 'Sales report'} description={isFa ? 'شش ماه اخیر، فقط پرداخت‌های تأییدشده' : 'Last six months, verified payments only'}>
          <div className="admin-chart-canvas">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                interaction: { intersect: false, mode: 'index' },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#74797C', font: { size: 10 } } },
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(221,216,206,.55)' },
                    ticks: { color: '#74797C', font: { size: 10 }, callback: (value: string | number) => formatMoney(Number(value), locale) },
                  },
                },
              }}
            />
          </div>
        </AdminPanel>

        <AdminPanel title={isFa ? 'سفارش‌های اخیر' : 'Recent orders'} description={isFa ? 'پنج سفارش ثبت‌شده اخیر' : 'Five latest persisted orders'}>
          {stats.recentOrders.length === 0 ? (
            <AdminEmptyState title={isFa ? 'هنوز سفارشی نیست' : 'No orders yet'} description={isFa ? 'پس از ثبت اولین سفارش، اطلاعات آن اینجا دیده می‌شود.' : 'The first persisted order will appear here.'} icon="orders" />
          ) : (
            <div className="admin-list">
              {stats.recentOrders.map((order) => (
                <div className="admin-list-row" key={order.id}>
                  <div><strong>{order.orderNumber}</strong><small>{order.customerName} · {formatDate(order.createdAtUtc, locale)}</small></div>
                  <div className="admin-list-end"><span>{formatMoney(order.totalAmount, locale)}</span><StatusBadge value={order.status} locale={locale} /></div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </section>
  );
});
