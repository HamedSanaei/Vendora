import { productSortOptions, type ProductSort } from '../utils/product-sort';

/** One existing-style sort control shared by the catalog table and grid, keeping both views in sync through URL state. */
export function AdminProductSort({ locale, value, onChange }: { locale: 'fa' | 'en'; value: ProductSort; onChange: (value: string) => void }) {
  return <select className="admin-filter-select" aria-label={locale === 'fa' ? 'مرتب‌سازی محصولات' : 'Sort products'} value={value} onChange={event => onChange(event.target.value)}>
    {productSortOptions.map(option => <option key={option.value} value={option.value}>{option[locale]}</option>)}
  </select>;
}
