import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminBrand } from '../types';

/** Manages persisted catalog brands using the shared responsive admin primitives. */
export const AdminBrandsPage = observer(function AdminBrandsPage() {
  const { brands } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [logoUrl, setLogoUrl] = useState(''); const [email, setEmail] = useState(''); const [website, setWebsite] = useState(''); const [description, setDescription] = useState(''); const [location, setLocation] = useState(''); const [isActive, setIsActive] = useState(true);

  useEffect(() => { void brands.loadBrands(); }, [brands]);

  function reset(): void { setEditing(null); setName(''); setSlug(''); setLogoUrl(''); setEmail(''); setWebsite(''); setDescription(''); setLocation(''); setIsActive(true); }
  function startEdit(brand: AdminBrand): void { setEditing(brand); setName(brand.name); setSlug(brand.slug); setLogoUrl(brand.logoUrl ?? ''); setEmail(brand.email ?? ''); setWebsite(brand.website ?? ''); setDescription(brand.description ?? ''); setLocation(brand.location ?? ''); setIsActive(brand.isActive); }
  async function handleSubmit(event: FormEvent): Promise<void> { event.preventDefault(); const input = { name, slug, logoUrl, email, website, description, location, isActive }; const ok = editing ? await brands.updateBrand(editing.id, input) : await brands.createBrand(input); if (ok) { toast.success(isFa ? (editing ? 'برند به‌روزرسانی شد.' : 'برند ایجاد شد.') : (editing ? 'Brand updated.' : 'Brand created.')); reset(); } }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'هویت سازندگان' : 'Manufacturer identity'} title={isFa ? 'برندها' : 'Brands'} description={isFa ? 'اطلاعات برندهای قابل انتساب به محصولات را مدیریت کنید.' : 'Manage manufacturers that can be assigned to products.'} />
      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>{isFa ? 'نام برند' : 'Name'}<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>{isFa ? 'اسلاگ' : 'Slug'}<input dir="ltr" value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>{isFa ? 'آدرس لوگو' : 'Logo URL'}<input dir="ltr" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label><label>{isFa ? 'ایمیل' : 'Email'}<input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{isFa ? 'وب‌سایت' : 'Website'}<input dir="ltr" value={website} onChange={(event) => setWebsite(event.target.value)} /></label><label>{isFa ? 'موقعیت' : 'Location'}<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>{isFa ? 'وضعیت' : 'Status'}<select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}><option value="active">{isFa ? 'فعال' : 'Active'}</option><option value="inactive">{isFa ? 'غیرفعال' : 'Inactive'}</option></select></label>
        </div>
        <label className="admin-form-full">{isFa ? 'توضیحات' : 'Description'}<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {brands.error ? <AdminFeedback tone="error">{brands.error}</AdminFeedback> : null}
        <div className="admin-form-actions"><AdminButton onClick={reset} variant="secondary">{isFa ? 'انصراف' : 'Cancel'}</AdminButton><AdminButton type="submit" variant="brass">{isFa ? (editing ? 'ذخیره برند' : 'افزودن برند') : (editing ? 'Update brand' : 'Add brand')}</AdminButton></div>
      </form>
      <AdminPanel title={isFa ? 'فهرست برندها' : 'Brand list'}>
        {brands.brands.length === 0 ? <AdminEmptyState icon="brand" title={isFa ? 'برندی وجود ندارد' : 'No brands'} description={isFa ? 'اولین برند را با فرم بالا ایجاد کنید.' : 'Create the first brand using the form above.'} /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{isFa ? 'برند' : 'Brand'}</th><th>{isFa ? 'اسلاگ' : 'Slug'}</th><th>{isFa ? 'وب‌سایت' : 'Website'}</th><th>{isFa ? 'محصولات' : 'Products'}</th><th>{isFa ? 'وضعیت' : 'Status'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead><tbody>{brands.brands.map((brand) => <tr key={brand.id}><td data-label={isFa ? 'برند' : 'Brand'}><strong>{brand.name}</strong></td><td data-label={isFa ? 'اسلاگ' : 'Slug'} dir="ltr">{brand.slug}</td><td data-label={isFa ? 'وب‌سایت' : 'Website'} dir="ltr">{brand.website ?? '—'}</td><td data-label={isFa ? 'محصولات' : 'Products'}>{brand.productCount.toLocaleString(isFa ? 'fa-IR' : 'en-US')}</td><td data-label={isFa ? 'وضعیت' : 'Status'}><StatusBadge locale={locale} value={brand.isActive ? 'Active' : 'Inactive'} /></td><td data-label={isFa ? 'عملیات' : 'Action'}><div className="admin-row-actions"><AdminButton icon="edit" onClick={() => startEdit(brand)} variant="secondary">{isFa ? 'ویرایش' : 'Edit'}</AdminButton><AdminButton icon="trash" onClick={() => void brands.deleteBrand(brand.id)} variant="danger">{isFa ? 'حذف' : 'Delete'}</AdminButton></div></td></tr>)}</tbody></table></div>}
      </AdminPanel>
    </section>
  );
});
