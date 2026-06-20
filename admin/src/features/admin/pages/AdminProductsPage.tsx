import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { adminPath, adminText, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatMoney } from '../utils/formatters';

export const AdminProductsPage = observer(function AdminProductsPage() {
  const { products } = useAdminStore();
  const navigate = useNavigate();
  const locale = normalizeAdminLocale(useParams().locale);

  if (products.isLoading) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading products..." />
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title admin-title-row">
        <div>
          <h1>Product List</h1>
          <p>Products are loaded from the ASP.NET Core API</p>
        </div>
        <button className="admin-primary-btn" type="button" onClick={() => navigate(adminPath(locale, 'add-product'))}>
          {adminText(locale, 'addProduct')}
        </button>
      </div>

      {products.error ? <div className="admin-error">{products.error}</div> : null}

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-cell">
                      <img src={product.imageUrl} alt={product.title} />
                      <div>
                        <strong>{product.title}</strong>
                        <small>{product.slug}</small>
                        <small>{product.imageUrls.length} image{product.imageUrls.length === 1 ? '' : 's'}</small>
                      </div>
                    </div>
                  </td>
                  <td>{product.categoryName}</td>
                  <td>{formatMoney(product.price, locale)}</td>
                  <td>{product.stockQuantity}</td>
                  <td><StatusBadge value={product.inventoryStatus} /></td>
                  <td>
                    <button
                      className="admin-ghost-btn"
                      type="button"
                      onClick={() => navigate(adminPath(locale, `products/${product.id}/edit`))}
                    >
                      {adminText(locale, 'edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className="admin-pagination" aria-label="Product pagination">
          <button type="button" disabled>
            Prev
          </button>
          <button type="button" className="active" aria-current="page">
            1
          </button>
          <button type="button" disabled>
            Next
          </button>
        </nav>
      </article>
    </section>
  );
});
