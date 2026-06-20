import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { adminPath, adminText, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import { formatMoney } from '../utils/formatters';

export const AdminProductGridPage = observer(function AdminProductGridPage() {
  const { products } = useAdminStore();
  const navigate = useNavigate();
  const locale = normalizeAdminLocale(useParams().locale);

  if (products.isLoading) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading product grid..." />
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Product Grid</h1>
        <p>Grid presentation for catalog management</p>
      </div>

      <div className="admin-product-grid">
        {products.products.map((product) => (
          <article className="admin-product-card" key={product.id}>
            <img src={product.imageUrl} alt={product.title} />
            <div className="admin-product-card-body">
              <div>
                <h2>{product.title}</h2>
                <p>{product.categoryName}</p>
              </div>
              <strong>{formatMoney(product.price, locale)}</strong>
              <div className="admin-card-footer">
                <span>{product.stockQuantity} in stock</span>
                <span>{product.imageUrls.length} image{product.imageUrls.length === 1 ? '' : 's'}</span>
                <StatusBadge value={product.inventoryStatus} />
              </div>
              <button className="admin-ghost-btn" type="button" onClick={() => navigate(adminPath(locale, `products/${product.id}/edit`))}>
                {adminText(locale, 'edit')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
});
