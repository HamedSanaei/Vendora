import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminCategory } from '../types';

/** Manages the localized category hierarchy with the shared Penpot form and table surfaces. */
export const AdminCategoriesPage = observer(function AdminCategoriesPage() {
  const { categories } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { void categories.loadCategories(); }, [categories]);

  function startEdit(category: AdminCategory): void { setEditing(category); setName(category.name); setSlug(category.slug); setParentCategoryId(category.parentCategoryId ?? ''); setIsActive(category.isActive); }
  function reset(): void { setEditing(null); setName(''); setSlug(''); setParentCategoryId(''); setIsActive(true); }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const ok = editing
      ? await categories.updateCategory(editing.id, { name, slug, parentCategoryId: parentCategoryId || undefined, isActive })
      : await categories.createCategory({ name, slug, parentCategoryId: parentCategoryId || undefined, isActive });
    if (ok) { toast.success(isFa ? (editing ? 'دسته‌بندی به‌روزرسانی شد.' : 'دسته‌بندی ایجاد شد.') : (editing ? 'Category updated.' : 'Category created.')); reset(); }
  }

  if (categories.isLoading && categories.categories.length === 0) return <section className="admin-page"><LoadingState label={isFa ? 'در حال بارگذاری دسته‌بندی‌ها…' : 'Loading categories…'} /></section>;

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'ساختار کاتالوگ' : 'Catalog structure'} title={isFa ? 'دسته‌بندی‌ها' : 'Categories'} description={isFa ? 'ساختار والد و فرزند محصولات را بدون حذف دائمی مدیریت کنید.' : 'Manage the parent-child catalog hierarchy with safe soft deletion.'} />
      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>{isFa ? 'نام دسته‌بندی' : 'Name'}<input required value={name} onChange={(event) => setName(event.target.value)} placeholder={isFa ? 'مثلاً کوله‌پشتی' : 'Backpacks'} /></label>
          <label>{isFa ? 'اسلاگ' : 'Slug'}<input dir="ltr" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="backpacks" /></label>
          <label>{isFa ? 'وضعیت' : 'Status'}<select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}><option value="active">{isFa ? 'فعال' : 'Active'}</option><option value="inactive">{isFa ? 'غیرفعال' : 'Inactive'}</option></select></label>
          <label>{isFa ? 'دسته‌بندی والد' : 'Parent category'}<select value={parentCategoryId} onChange={(event) => setParentCategoryId(event.target.value)}><option value="">{isFa ? 'بدون والد' : 'No parent'}</option>{categories.categories.filter((category) => category.id !== editing?.id).map((category) => <option value={category.id} key={category.id}>{category.parentCategoryId ? `— ${category.name}` : category.name}</option>)}</select></label>
        </div>
        {categories.error ? <AdminFeedback tone="error">{categories.error}</AdminFeedback> : null}
        <div className="admin-form-actions"><AdminButton onClick={reset} variant="secondary">{isFa ? 'انصراف' : 'Cancel'}</AdminButton><AdminButton type="submit" variant="brass">{isFa ? (editing ? 'ذخیره تغییرات' : 'افزودن دسته‌بندی') : (editing ? 'Update category' : 'Add category')}</AdminButton></div>
      </form>

      <AdminPanel title={isFa ? 'فهرست دسته‌بندی‌ها' : 'Category list'} description={`${categories.categories.length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} ${isFa ? 'دسته‌بندی' : 'categories'}`}>
        {categories.categories.length === 0 ? <AdminEmptyState icon="category" title={isFa ? 'دسته‌بندی‌ای وجود ندارد' : 'No categories'} description={isFa ? 'فرم بالا را برای ساخت اولین دسته‌بندی تکمیل کنید.' : 'Use the form above to create the first category.'} /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{isFa ? 'نام' : 'Name'}</th><th>{isFa ? 'اسلاگ' : 'Slug'}</th><th>{isFa ? 'والد' : 'Parent'}</th><th>{isFa ? 'محصولات' : 'Products'}</th><th>{isFa ? 'وضعیت' : 'Status'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead><tbody>{categories.categories.map((category) => <tr key={category.id}><td data-label={isFa ? 'نام' : 'Name'}><strong>{category.name}</strong></td><td data-label={isFa ? 'اسلاگ' : 'Slug'} dir="ltr">{category.slug}</td><td data-label={isFa ? 'والد' : 'Parent'}>{category.parentCategoryName ?? '—'}</td><td data-label={isFa ? 'محصولات' : 'Products'}>{category.productCount.toLocaleString(isFa ? 'fa-IR' : 'en-US')}</td><td data-label={isFa ? 'وضعیت' : 'Status'}><StatusBadge locale={locale} value={category.isActive ? 'Active' : 'Inactive'} /></td><td data-label={isFa ? 'عملیات' : 'Action'}><div className="admin-row-actions"><AdminButton icon="edit" onClick={() => startEdit(category)} variant="secondary">{isFa ? 'ویرایش' : 'Edit'}</AdminButton><AdminButton icon="trash" onClick={() => void categories.deleteCategory(category.id)} variant="danger">{isFa ? 'حذف' : 'Delete'}</AdminButton></div></td></tr>)}</tbody></table></div>}
      </AdminPanel>
    </section>
  );
});
