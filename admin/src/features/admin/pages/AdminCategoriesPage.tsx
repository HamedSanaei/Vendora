import { observer } from 'mobx-react-lite';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminCategory } from '../types';
import { CategoryTree } from '../components/CategoryTree';
import { descendantCategoryIds } from '../utils/category-tree';
import { SeoPanel } from '../components/SeoPanel';
import { emptySeo, type SeoInput } from '../seo/types';
import { LazyArticleEditor } from '../components/rich-text/LazyArticleEditor';
import { uploadProductArticleImage } from '../api/adminApi';

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
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [seo, setSeo] = useState<SeoInput>(emptySeo);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void categories.loadCategories(); }, [categories]);

  function startEdit(category: AdminCategory): void { setEditing(category); setName(category.name); setSlug(category.slug); setParentCategoryId(category.parentCategoryId ?? ''); setIsActive(category.isActive); setDescription(category.description ?? ''); setImageUrl(category.imageUrl ?? ''); setSeo(category.seo?.fields ?? emptySeo); }
  function reset(): void { setEditing(null); setName(''); setSlug(''); setParentCategoryId(''); setIsActive(true); setDescription(''); setImageUrl(''); setSeo(emptySeo); }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (saving || uploading) return;
    setSaving(true);
    const ok = editing
      ? await categories.updateCategory(editing.id, { name, slug, parentCategoryId: parentCategoryId || undefined, isActive, description, imageUrl, seo })
      : await categories.createCategory({ name, slug, parentCategoryId: parentCategoryId || undefined, isActive, description, imageUrl, seo });
    setSaving(false);
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
          <label>تصویر دسته (آدرس عمومی یا فایل آپلودشده)<input value={imageUrl} maxLength={500} onChange={event => setImageUrl(event.target.value)} /></label>
          <label>بارگذاری تصویر دسته<input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving || uploading} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            setUploading(true);
            void uploadProductArticleImage(file).then(setImageUrl).catch(() => toast.error('بارگذاری تصویر انجام نشد. نوع و اندازهٔ فایل را بررسی کنید.')).finally(() => setUploading(false));
          }} /></label>
        </div>
        <p className="admin-attribute-help">غیرفعال‌کردن والد، همهٔ زیرشاخه‌ها را از نمایش عمومی خارج می‌کند؛ محصولات و اتصال‌هایشان حذف نمی‌شوند.</p>
        <CategoryTree label="دسته‌بندی والد" categories={categories.categories} mode="single" selectedIds={parentCategoryId ? [parentCategoryId] : []}
          disabledIds={editing ? [...descendantCategoryIds(categories.categories, editing.id)] : []} disabled={saving}
          onChange={ids => setParentCategoryId(ids[0] ?? '')} />
        <Suspense fallback={<p role="status">در حال آماده‌سازی ویرایشگر…</p>}><LazyArticleEditor key={editing?.id ?? 'new'} locale={locale} value={description} disabled={saving}
          onChange={setDescription} onBusyChange={setUploading} uploadImage={uploadProductArticleImage} /></Suspense>
        {isFa && <SeoPanel draft={{kind:'category',id:editing?.id,name,slug,content:description,seo,images:imageUrl ? [{url:imageUrl,alt:name}] : []}}
          onChange={setSeo} onContentChange={setDescription} disabled={saving || uploading} />}
        {categories.error ? <AdminFeedback tone="error">{categories.error}</AdminFeedback> : null}
        <div className="admin-form-actions"><AdminButton onClick={reset} disabled={saving} variant="secondary">{isFa ? 'انصراف' : 'Cancel'}</AdminButton><AdminButton disabled={saving || uploading} type="submit" variant="brass">{saving ? 'در حال ذخیره…' : isFa ? (editing ? 'ذخیره تغییرات' : 'افزودن دسته‌بندی') : (editing ? 'Update category' : 'Add category')}</AdminButton></div>
      </form>

      <AdminPanel title={isFa ? 'فهرست دسته‌بندی‌ها' : 'Category list'} description={`${categories.categories.length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} ${isFa ? 'دسته‌بندی' : 'categories'}`}>
        {categories.categories.length === 0 ? <AdminEmptyState icon="category" title="دسته‌بندی‌ای وجود ندارد" description="فرم بالا را برای ساخت اولین دسته تکمیل کنید." /> :
          <CategoryTree categories={categories.categories} mode="browse" renderActions={node => {
            const category = categories.categories.find(value => value.id === node.id)!;
            return <><StatusBadge locale={locale} value={category.isActive ? 'Active' : 'Inactive'} /><small>{category.productCount.toLocaleString('fa-IR')} اتصال مستقیم</small>
              <AdminButton icon="edit" disabled={saving} onClick={() => startEdit(category)} variant="secondary">ویرایش</AdminButton>
              <AdminButton icon="trash" disabled={saving} onClick={() => void categories.deleteCategory(category.id)} variant="danger">غیرفعال‌کردن</AdminButton></>;
          }} />}
      </AdminPanel>
    </section>
  );
});
