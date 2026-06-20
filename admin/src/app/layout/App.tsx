
import { Navigate, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom';
import { AdminErrorBoundary } from '../../features/admin/components/AdminErrorBoundary';
import { AdminLayout } from '../../features/admin/components/AdminLayout';
import { AdminAddProductPage } from '../../features/admin/pages/AdminAddProductPage';
import { AdminAuthShellPage } from '../../features/admin/pages/AdminAuthShellPage';
import { AdminBrandsPage } from '../../features/admin/pages/AdminBrandsPage';
import { AdminCategoriesPage } from '../../features/admin/pages/AdminCategoriesPage';
import { AdminCouponsPage } from '../../features/admin/pages/AdminCouponsPage';
import { AdminDashboardPage } from '../../features/admin/pages/AdminDashboardPage';
import { AdminOnlineStorePage } from '../../features/admin/pages/AdminOnlineStorePage';
import { AdminOrderDetailsPage } from '../../features/admin/pages/AdminOrderDetailsPage';
import { AdminOrdersPage } from '../../features/admin/pages/AdminOrdersPage';
import { AdminProductGridPage } from '../../features/admin/pages/AdminProductGridPage';
import { AdminProductsPage } from '../../features/admin/pages/AdminProductsPage';
import { AdminProfilePage } from '../../features/admin/pages/AdminProfilePage';
import { AdminStaffPage } from '../../features/admin/pages/AdminStaffPage';
import { adminPath, normalizeAdminLocale } from '../../features/admin/i18n';

function LocaleAdminNavigate({ to }: { to?: string }) {
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  return <Navigate to={adminPath(locale, to ?? '')} replace />;
}

function App() {
  return (
    <AdminErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/fa/admin" replace />} />
          <Route path="/admin/*" element={<Navigate to="/fa/admin" replace />} />
          <Route path="/:locale/admin" element={<AdminLayout />}>
            <Route index element={<LocaleAdminNavigate to="dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="products" element={<LocaleAdminNavigate to="product-list" />} />
            <Route path="product-list" element={<AdminProductsPage />} />
            <Route path="product-grid" element={<AdminProductGridPage />} />
            <Route path="add-product" element={<AdminAddProductPage />} />
            <Route path="products/:id/edit" element={<AdminAddProductPage mode="edit" />} />
            <Route path="category" element={<AdminCategoriesPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
            <Route path="brands" element={<AdminBrandsPage />} />
            <Route path="coupon" element={<AdminCouponsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="online-store" element={<AdminOnlineStorePage />} />
            <Route path="our-staff" element={<AdminStaffPage />} />
            <Route path="pages" element={<LocaleAdminNavigate to="login" />} />
            <Route path="register" element={<AdminAuthShellPage mode="register" />} />
            <Route path="login" element={<AdminAuthShellPage mode="login" />} />
            <Route path="forgot-password" element={<AdminAuthShellPage mode="forgot" />} />
            <Route path="reset-password" element={<AdminAuthShellPage mode="reset" />} />
          </Route>
        </Routes>
      </Router>
    </AdminErrorBoundary>
  );
}

export default App;
