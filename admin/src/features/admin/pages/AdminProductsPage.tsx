import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AdminActionMenu, AdminBulkSelectionBar, AdminButton, AdminCheckbox, AdminChip, AdminEmptyState, AdminFeedback, AdminFilterBar, AdminPageHeader, AdminPagination, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminProductQuery } from '../hooks/useAdminProductQuery';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatMoney } from '../utils/formatters';

/** Renders the searchable, responsive product table using persisted catalog data. */
export const AdminProductsPage = observer(function AdminProductsPage() {
  const { products } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const list = useAdminProductQuery(products.products, 10);

  useEffect(() => {
    void Promise.all([products.loadProducts(), products.loadCategoryOptions()]);
  }, [products]);

  const allPageSelected = list.pageItems.length > 0 && list.pageItems.every((product) => selectedIds.includes(product.id));
  const selectedProduct = selectedIds.length === 1 ? products.products.find((product) => product.id === selectedIds[0]) : undefined;

  /** Selects or clears every product visible on the current paginated page. */
  function toggleCurrentPage(): void {
    const pageIds = list.pageItems.map((product) => product.id);
    setSelectedIds((current) => allPageSelected
      ? current.filter((id) => !pageIds.includes(id))
      : Array.from(new Set([...current, ...pageIds])));
  }

  /** Toggles one product in the reusable bulk selection state. */
  function toggleProduct(productId: string): void {
    setSelectedIds((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  }

  if (products.isLoading && products.products.length === 0) {
    return <section className="admin-page"><LoadingState label={isFa ? 'در حال بارگذاری محصولات…' : 'Loading products…'} /></section>;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'مدیریت کاتالوگ' : 'Catalog management'}
        title={isFa ? 'محصولات' : 'Products'}
        description={isFa ? `${list.totalItems.toLocaleString('fa-IR')} محصول مطابق فیلترهای فعلی` : `${list.totalItems} products match the current filters`}
        actions={<AdminButton icon="plus" to={adminPath(locale, 'add-product')} variant="brass">{isFa ? 'افزودن محصول' : 'Add product'}</AdminButton>}
      />

      {products.error ? <AdminFeedback tone="error">{products.error}</AdminFeedback> : null}

      <AdminPanel>
        <AdminFilterBar searchLabel={isFa ? 'جستجو بر اساس نام، اسلاگ یا برند…' : 'Search title, slug, or brand…'} searchValue={list.query} onSearchChange={list.setQuery}>
          <select aria-label={isFa ? 'فیلتر دسته‌بندی' : 'Category filter'} className="admin-filter-select" onChange={(event) => list.setCategory(event.target.value)} value={list.category}>
            <option value="all">{isFa ? 'همه دسته‌بندی‌ها' : 'All categories'}</option>
            {products.categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select aria-label={isFa ? 'فیلتر وضعیت' : 'Status filter'} className="admin-filter-select" onChange={(event) => list.setStatus(event.target.value)} value={list.status}>
            <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All statuses'}</option>
            <option value="Active">{isFa ? 'فعال' : 'Active'}</option>
            <option value="Draft">{isFa ? 'پیش‌نویس' : 'Draft'}</option>
            <option value="Archived">{isFa ? 'آرشیو' : 'Archived'}</option>
            <option value="LowStock">{isFa ? 'رو به اتمام' : 'Low stock'}</option>
            <option value="OutOfStock">{isFa ? 'ناموجود' : 'Out of stock'}</option>
          </select>
          <div className="admin-view-switch" aria-label={isFa ? 'نوع نمایش' : 'View mode'}>
            <AdminButton icon="list" variant="primary">{isFa ? 'لیست' : 'List'}</AdminButton>
            <AdminButton icon="grid" to={`${adminPath(locale, 'product-grid')}?${new URLSearchParams(location.search).toString()}`} variant="secondary">{isFa ? 'گرید' : 'Grid'}</AdminButton>
          </div>
        </AdminFilterBar>

        <AdminBulkSelectionBar clearLabel={isFa ? 'لغو انتخاب' : 'Clear'} count={selectedIds.length} countLabel={isFa ? 'محصول انتخاب شده' : 'products selected'} locale={locale} onClear={() => setSelectedIds([])}>
          {selectedProduct ? <AdminButton icon="edit" to={adminPath(locale, `products/${selectedProduct.id}/edit`)} variant="secondary">{isFa ? 'ویرایش محصول' : 'Edit product'}</AdminButton> : <AdminChip tone="brass">{isFa ? 'برای ویرایش، یک محصول را انتخاب کنید' : 'Select one product to edit'}</AdminChip>}
        </AdminBulkSelectionBar>

        {list.pageItems.length === 0 ? (
          <AdminEmptyState
            title={isFa ? 'محصولی پیدا نشد' : 'No products found'}
            description={isFa ? 'فیلترها را تغییر دهید یا محصول تازه‌ای ایجاد کنید.' : 'Adjust the filters or create a new product.'}
            action={<AdminButton icon="plus" to={adminPath(locale, 'add-product')} variant="brass">{isFa ? 'محصول جدید' : 'New product'}</AdminButton>}
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th className="admin-selection-cell"><AdminCheckbox aria-label={isFa ? 'انتخاب همه محصولات این صفحه' : 'Select all products on this page'} checked={allPageSelected} label={<span className="sr-only">{isFa ? 'انتخاب همه' : 'Select all'}</span>} onChange={toggleCurrentPage} /></th><th>{isFa ? 'محصول' : 'Product'}</th><th>{isFa ? 'دسته‌بندی' : 'Category'}</th><th>{isFa ? 'قیمت' : 'Price'}</th><th>{isFa ? 'موجودی' : 'Stock'}</th><th>{isFa ? 'انتشار' : 'Publishing'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead>
              <tbody>
                {list.pageItems.map((product) => (
                  <tr key={product.id}>
                    <td className="admin-selection-cell" data-label={isFa ? 'انتخاب' : 'Select'}><AdminCheckbox aria-label={`${isFa ? 'انتخاب' : 'Select'} ${product.title}`} checked={selectedIds.includes(product.id)} label={<span className="sr-only">{product.title}</span>} onChange={() => toggleProduct(product.id)} /></td>
                    <td data-label={isFa ? 'محصول' : 'Product'}><div className="admin-product-cell"><img src={product.imageUrl} alt="" /><div><strong>{product.title}</strong><small>{product.slug}</small><small>{product.brandName ?? (isFa ? 'بدون برند' : 'No brand')}</small></div></div></td>
                    <td data-label={isFa ? 'دسته‌بندی' : 'Category'}>{product.categoryName}</td>
                    <td data-label={isFa ? 'قیمت' : 'Price'}>{formatMoney(product.price, locale)}</td>
                    <td data-label={isFa ? 'موجودی' : 'Stock'}><span>{product.stockQuantity.toLocaleString(isFa ? 'fa-IR' : 'en-US')}</span><StatusBadge locale={locale} value={product.inventoryStatus} /></td>
                    <td data-label={isFa ? 'انتشار' : 'Publishing'}><StatusBadge locale={locale} value={product.status} /></td>
                    <td data-label={isFa ? 'عملیات' : 'Action'}><AdminActionMenu label={isFa ? `عملیات ${product.title}` : `${product.title} actions`}><AdminButton icon="edit" to={adminPath(locale, `products/${product.id}/edit`)} variant="ghost">{isFa ? 'ویرایش' : 'Edit'}</AdminButton></AdminActionMenu></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination currentPage={list.page} label={isFa ? 'صفحه‌بندی محصولات' : 'Product pagination'} locale={locale} onPageChange={list.setPage} totalPages={list.totalPages} />
      </AdminPanel>
    </section>
  );
});
