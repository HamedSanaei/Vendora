import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { toast } from 'react-toastify';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminBrand } from '../types';

export const AdminBrandsPage = observer(function AdminBrandsPage() {
  const { brands } = useAdminStore();
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);

  function reset(): void {
    setEditing(null);
    setName('');
    setSlug('');
    setLogoUrl('');
    setEmail('');
    setWebsite('');
    setDescription('');
    setLocation('');
    setIsActive(true);
  }

  function startEdit(brand: AdminBrand): void {
    setEditing(brand);
    setName(brand.name);
    setSlug(brand.slug);
    setLogoUrl(brand.logoUrl ?? '');
    setEmail(brand.email ?? '');
    setWebsite(brand.website ?? '');
    setDescription(brand.description ?? '');
    setLocation(brand.location ?? '');
    setIsActive(brand.isActive);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const input = { name, slug, logoUrl, email, website, description, location, isActive };
    const ok = editing ? await brands.updateBrand(editing.id, input) : await brands.createBrand(input);

    if (ok) {
      toast.success(editing ? 'Brand updated.' : 'Brand created.');
      reset();
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Brand</h1>
        <p>Create, edit, and soft delete brands.</p>
      </div>

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
          <label>Logo URL<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Website<input value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <label>
            Status
            <select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <label className="admin-form-full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {brands.error ? <div className="admin-error">{brands.error}</div> : null}
        <div className="admin-form-actions">
          <button className="admin-ghost-btn" type="button" onClick={reset}>Cancel</button>
          <button className="admin-primary-btn" type="submit">{editing ? 'Update Brand' : 'Add Brand'}</button>
        </div>
      </form>

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Website</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {brands.brands.map((brand) => (
                <tr key={brand.id}>
                  <td><strong>{brand.name}</strong></td>
                  <td>{brand.slug}</td>
                  <td>{brand.website ?? '-'}</td>
                  <td><StatusBadge value={brand.isActive ? 'Active' : 'Inactive'} /></td>
                  <td>
                    <button className="admin-ghost-btn" type="button" onClick={() => startEdit(brand)}>Edit</button>
                    <button className="admin-danger-btn" type="button" onClick={() => void brands.deleteBrand(brand.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
});
