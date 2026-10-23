import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminFilterBar, AdminPageHeader, AdminPagination } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminProductQuery } from '../hooks/useAdminProductQuery';
import { adminPath, adminText, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatMoney } from '../utils/formatters';
import { productStorefrontUrl } from '../utils/storefront';

/** Renders the shared product dataset in the Penpot responsive card-grid view. */
export const AdminProductGridPage = observer(function AdminProductGridPage() {
  const { products } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const location = useLocation();
  const list = useAdminProductQuery(products.products, 9);

  useEffect(() => {
    void Promise.all([products.loadProducts(), products.loadCategoryOptions()]);
  }, [products]);

  if (products.isLoading && products.products.length === 0) {
    return <section className="admin-page"><LoadingState label={isFa ? 'در حال بارگذاری محصولات…' : 'Loading products…'} /></section>;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'نمای بصری کاتالوگ' : 'Visual catalog'}
        title={isFa ? 'گرید محصولات' : 'Product grid'}
        description={isFa ? 'تصاویر، قیمت و موجودی محصولات را در یک نمای سریع بررسی کنید.' : 'Review product imagery, price, and stock at a glance.'}
        actions={<AdminButton icon="plus" to={adminPath(locale, 'add-product')} variant="brass">{isFa ? 'افزودن محصول' : 'Add product'}</AdminButton>}
      />
      {products.error ? <AdminFeedback tone="error">{products.error}</AdminFeedback> : null}

      <AdminFilterBar searchLabel={isFa ? 'جستجو در محصولات…' : 'Search products…'} searchValue={list.query} onSearchChange={list.setQuery}>
        <select aria-label={isFa ? 'فیلتر دسته‌بندی' : 'Category filter'} className="admin-filter-select" onChange={(event) => list.setCategory(event.target.value)} value={list.category}>
          <option value="all">{isFa ? 'همه دسته‌بندی‌ها' : 'All categories'}</option>
          {products.categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select aria-label={isFa ? 'فیلتر وضعیت' : 'Status filter'} className="admin-filter-select" onChange={(event) => list.setStatus(event.target.value)} value={list.status}>
          <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
          <option value="Active">{isFa ? 'فعال' : 'Active'}</option><option value="Draft">{isFa ? 'پیش‌نویس' : 'Draft'}</option><option value="Archived">{isFa ? 'آرشیو' : 'Archived'}</option><option value="LowStock">{isFa ? 'رو به اتمام' : 'Low stock'}</option>
        </select>
        <div className="admin-view-switch">
          <AdminButton icon="list" to={`${adminPath(locale, 'product-list')}?${new URLSearchParams(location.search).toString()}`} variant="secondary">{isFa ? 'لیست' : 'List'}</AdminButton>
          <AdminButton icon="grid" variant="primary">{isFa ? 'گرید' : 'Grid'}</AdminButton>
        </div>
      </AdminFilterBar>

      {list.pageItems.length === 0 ? (
        <AdminEmptyState title={isFa ? 'محصولی پیدا نشد' : 'No products found'} description={isFa ? 'عبارت جستجو یا فیلترهای انتخاب‌شده را تغییر دهید.' : 'Adjust your search or filters.'} />
      ) : (
        <div className="admin-product-grid">
          {list.pageItems.map((product) => (
            <article className="admin-product-card" key={product.id}>
              <img src={product.imageUrl} alt={product.title} />
              <div className="admin-product-card-body">
                <div><h2>{product.title}</h2><p>{product.categoryName} · {product.brandName ?? (isFa ? 'بدون برند' : 'No brand')}</p></div>
                <small>{isFa ? 'کد محصول' : 'Product code'}: <bdi>{product.productCode}</bdi></small>
                <strong>{formatMoney(product.price, locale)}</strong>
                {isFa && <small>امتیاز سئو: {product.seo?.score == null ? 'بررسی نشده' : `${product.seo.score.toLocaleString('fa-IR')} از ۱۰۰`}</small>}
                <div className="admin-card-footer">
                  <span>{product.stockQuantity.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'عدد' : 'in stock'}</span>
                  <StatusBadge locale={locale} value={product.inventoryStatus} />
                  <StatusBadge locale={locale} value={product.status} />
                </div>
                <div className="admin-product-actions">
                  <AdminButton external icon="eye" variant="secondary" disabled={product.status !== 'Active'}
                    title={product.status !== 'Active' ? adminText(locale, 'publishToView') : undefined}
                    to={product.status === 'Active' ? productStorefrontUrl(locale, product.slug) : undefined}>
                    {adminText(locale, 'viewProduct')}
                  </AdminButton>
                  <AdminButton icon="edit" to={adminPath(locale, `products/${product.id}/edit`)} variant="secondary">{isFa ? 'ویرایش محصول' : 'Edit product'}</AdminButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <AdminPagination currentPage={list.page} label={isFa ? 'صفحه‌بندی محصولات' : 'Product pagination'} locale={locale} onPageChange={list.setPage} totalPages={list.totalPages} />
    </section>
  );
});
