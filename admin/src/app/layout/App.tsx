import { AdminSupportTicketsPage } from "../../features/admin/pages/AdminSupportTicketsPage";

import { useEffect } from 'react';
import { AdminStoreDocument, AdminStoreSettingsProvider } from '../../features/admin/components/AdminStoreSettingsProvider';
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom';
import { AdminErrorBoundary } from '../../features/admin/components/AdminErrorBoundary';
import { AdminLayout } from '../../features/admin/components/AdminLayout';
import { AdminAddProductPage } from '../../features/admin/pages/AdminAddProductPage';
import { AdminAuthShellPage } from '../../features/admin/pages/AdminAuthShellPage';
import { AdminBrandsPage } from '../../features/admin/pages/AdminBrandsPage';
import { AdminCategoriesPage } from '../../features/admin/pages/AdminCategoriesPage';
import { AdminColorsPage } from '../../features/admin/pages/AdminColorsPage';
import { AdminAttributesPage } from '../../features/admin/pages/AdminAttributesPage';
import { AdminSeoPage } from '../../features/admin/pages/AdminSeoPage';
import { AdminDiscussionsPage } from '../../features/admin/pages/AdminDiscussionsPage';
import { AdminCouponsPage } from '../../features/admin/pages/AdminCouponsPage';
import { AdminDashboardPage } from '../../features/admin/pages/AdminDashboardPage';
import { AdminNewsletterPage } from '../../features/admin/pages/AdminNewsletterPage';
import { AdminOnlineStorePage } from '../../features/admin/pages/AdminOnlineStorePage';
import { AdminOrderDetailsPage } from '../../features/admin/pages/AdminOrderDetailsPage';
import { AdminOrdersPage } from '../../features/admin/pages/AdminOrdersPage';
import { AdminProductGridPage } from '../../features/admin/pages/AdminProductGridPage';
import { AdminProductsPage } from '../../features/admin/pages/AdminProductsPage';
import { AdminProfilePage } from '../../features/admin/pages/AdminProfilePage';
import { AdminStaffPage } from '../../features/admin/pages/AdminStaffPage';
import { AccountingPage } from '../../features/admin/accounting/AccountingPage';
import { AccountingOverview } from '../../features/admin/accounting/OverviewPage';
import { DocumentList } from '../../features/admin/accounting/DocumentList';
import { InvoiceEditor } from '../../features/admin/accounting/InvoiceEditor';
import { CounterpartiesPage, CounterpartyLedger } from '../../features/admin/accounting/CounterpartiesPage';
import { PaymentsPage } from '../../features/admin/accounting/PaymentsPage';
import { InventoryPage, ProductPriceReport } from '../../features/admin/accounting/InventoryPage';
import { SetupPage } from '../../features/admin/accounting/SetupPage';
import { ProfitReport } from '../../features/admin/accounting/ProfitReport';
import { adminPath, normalizeAdminLocale } from '../../features/admin/i18n';

function LocaleAdminNavigate({ to }: { to?: string }) {
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  return <Navigate to={adminPath(locale, to ?? '')} replace />;
}

/** Keeps document language and writing direction aligned with the locale URL. */
function AdminLocaleRoot() {
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
  }, [locale]);

  return <><AdminStoreDocument locale={locale} /><Outlet /></>;
}

function App() {
  return (
    <AdminErrorBoundary>
      <AdminStoreSettingsProvider><Router>
        <Routes>
          <Route path="/" element={<Navigate to="/fa/admin" replace />} />
          <Route path="/admin/*" element={<Navigate to="/fa/admin" replace />} />
          <Route path="/:locale/admin" element={<AdminLocaleRoot />}>
            <Route path="register" element={<AdminAuthShellPage mode="register" />} />
            <Route path="login" element={<AdminAuthShellPage mode="login" />} />
            <Route path="forgot-password" element={<AdminAuthShellPage mode="forgot" />} />
            <Route path="reset-password" element={<AdminAuthShellPage mode="reset" />} />
            <Route element={<AdminLayout />}>
              <Route index element={<LocaleAdminNavigate to="dashboard" />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="accounting" element={<AccountingPage />}>
                <Route index element={<AccountingOverview />} />
                <Route path="purchases" element={<DocumentList kind={0} />} />
                <Route path="sales" element={<DocumentList kind={1} />} />
                <Route path="quotes" element={<DocumentList kind={2} />} />
                <Route path="counterparties" element={<CounterpartiesPage />} />
                <Route path="counterparties/:id" element={<CounterpartyLedger />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="movements" element={<InventoryPage />} />
                <Route path="reports" element={<><AccountingOverview reports /><ProfitReport /><ProductPriceReport /></>} />
                <Route path="documents/new" element={<InvoiceEditor />} />
                <Route path="documents/:id" element={<InvoiceEditor />} />
                <Route path="returns" element={<InvoiceEditor returning />} />
                <Route path="setup" element={<SetupPage />} />
              </Route>
              <Route path="products" element={<LocaleAdminNavigate to="product-list" />} />
              <Route path="product-list" element={<AdminProductsPage />} />
              <Route path="product-grid" element={<AdminProductGridPage />} />
              <Route path="add-product" element={<AdminAddProductPage />} />
              <Route path="products/:id/edit" element={<AdminAddProductPage mode="edit" />} />
              <Route path="category" element={<AdminCategoriesPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
              <Route path="brands" element={<AdminBrandsPage />} />
              <Route path="colors" element={<AdminColorsPage />} />
              <Route path="attributes" element={<AdminAttributesPage />} />
              <Route path="seo" element={<AdminSeoPage />} />
              <Route path="tickets" element={<AdminSupportTicketsPage />} />
              <Route path="tickets/:id" element={<AdminSupportTicketsPage />} />
              <Route path="discussions" element={<AdminDiscussionsPage />} />
              <Route path="coupon" element={<AdminCouponsPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="newsletter-subscriptions" element={<AdminNewsletterPage />} />
              <Route path="online-store" element={<AdminOnlineStorePage />} />
              <Route path="our-staff" element={<AdminStaffPage />} />
              <Route path="pages" element={<LocaleAdminNavigate to="dashboard" />} />
            </Route>
          </Route>
        </Routes>
      </Router></AdminStoreSettingsProvider>
    </AdminErrorBoundary>
  );
}

export default App;
