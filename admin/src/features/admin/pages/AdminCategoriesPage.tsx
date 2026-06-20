import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { toast } from 'react-toastify';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminCategory } from '../types';

export const AdminCategoriesPage = observer(function AdminCategoriesPage() {
  const { categories } = useAdminStore();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);

  function startEdit(category: AdminCategory): void {
    setEditing(category);
    setName(category.name);
    setSlug(category.slug);
    setParentCategoryId(category.parentCategoryId ?? '');
    setIsActive(category.isActive);
  }

  function reset(): void {
    setEditing(null);
    setName('');
    setSlug('');
    setParentCategoryId('');
    setIsActive(true);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const ok = editing
      ? await categories.updateCategory(editing.id, { name, slug, parentCategoryId: parentCategoryId || undefined, isActive })
      : await categories.createCategory({ name, slug, parentCategoryId: parentCategoryId || undefined, isActive });

    if (ok) {
      toast.success(editing ? 'Category updated.' : 'Category created.');
      reset();
    }
  }

  if (categories.isLoading && categories.categories.length === 0) {
    return (
      <section className="admin-page">
        <LoadingState label="Loading categories..." />
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Category</h1>
        <p>Create, edit, and soft delete product categories.</p>
      </div>

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Backpacks" />
          </label>
          <label>
            Slug
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="backpacks" />
          </label>
          <label>
            Status
            <select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Parent category
            <select value={parentCategoryId} onChange={(event) => setParentCategoryId(event.target.value)}>
              <option value="">No parent</option>
              {categories.categories
                .filter((category) => category.id !== editing?.id)
                .map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.parentCategoryId ? `-- ${category.name}` : category.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {categories.error ? <div className="admin-error">{categories.error}</div> : null}
        <div className="admin-form-actions">
          <button className="admin-ghost-btn" type="button" onClick={reset}>Cancel</button>
          <button className="admin-primary-btn" type="submit">{editing ? 'Update Category' : 'Add Category'}</button>
        </div>
      </form>

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Parent</th>
                <th>Products</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.categories.map((category) => (
                <tr key={category.id}>
                  <td><strong>{category.name}</strong></td>
                  <td>{category.slug}</td>
                  <td>{category.parentCategoryName ?? '-'}</td>
                  <td>{category.productCount}</td>
                  <td><StatusBadge value={category.isActive ? 'Active' : 'Inactive'} /></td>
                  <td>
                    <button className="admin-ghost-btn" type="button" onClick={() => startEdit(category)}>Edit</button>
                    <button className="admin-danger-btn" type="button" onClick={() => void categories.deleteCategory(category.id)}>Delete</button>
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
