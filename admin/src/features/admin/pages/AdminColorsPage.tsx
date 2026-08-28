import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminColor } from '../types';

const messages = {
  fa: {
    title: 'رنگ‌ها',
    subtitle: 'رنگ‌های قابل انتخاب برای محصولات و فیلتر فروشگاه را مدیریت کنید.',
    name: 'نام رنگ',
    slug: 'اسلاگ',
    hexCode: 'کد رنگ',
    status: 'وضعیت',
    active: 'فعال',
    inactive: 'غیرفعال',
    preview: 'پیش‌نمایش',
    action: 'عملیات',
    cancel: 'انصراف',
    edit: 'ویرایش',
    delete: 'حذف',
    add: 'افزودن رنگ',
    update: 'به‌روزرسانی رنگ',
    created: 'رنگ با موفقیت ایجاد شد.',
    updated: 'رنگ با موفقیت به‌روزرسانی شد.',
  },
  en: {
    title: 'Colors',
    subtitle: 'Manage product colors used by product forms and storefront filters.',
    name: 'Color name',
    slug: 'Slug',
    hexCode: 'Hex code',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    preview: 'Preview',
    action: 'Action',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    add: 'Add Color',
    update: 'Update Color',
    created: 'Color created successfully.',
    updated: 'Color updated successfully.',
  },
} as const;

/** Renders the localized admin CRUD screen for catalog colors. */
export const AdminColorsPage = observer(function AdminColorsPage() {
  const { colors, products } = useAdminStore();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const text = messages[locale];
  const [editing, setEditing] = useState<AdminColor | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [hexCode, setHexCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    void colors.loadColors();
  }, [colors]);

  function reset(): void {
    setEditing(null);
    setName('');
    setSlug('');
    setHexCode('');
    setIsActive(true);
  }

  function startEdit(color: AdminColor): void {
    setEditing(color);
    setName(color.name);
    setSlug(color.slug);
    setHexCode(color.hexCode ?? '');
    setIsActive(color.isActive);
  }

  async function refreshProductColorOptions(): Promise<void> {
    await products.loadColorOptions();
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const input = { name, slug, hexCode, isActive };
    const ok = editing ? await colors.updateColor(editing.id, input) : await colors.createColor(input);

    if (ok) {
      await refreshProductColorOptions();
      toast.success(editing ? text.updated : text.created);
      reset();
    }
  }

  async function handleDelete(id: string): Promise<void> {
    const ok = await colors.deleteColor(id);
    if (ok) {
      await refreshProductColorOptions();
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={locale === 'fa' ? 'ویژگی‌های محصول' : 'Product attributes'} title={text.title} description={text.subtitle} />

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>{text.name}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>{text.slug}<input dir="ltr" value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
          <label>{text.hexCode}<input dir="ltr" placeholder="#0f172a" value={hexCode} onChange={(event) => setHexCode(event.target.value)} /></label>
          <label>
            {text.status}
            <select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}>
              <option value="active">{text.active}</option>
              <option value="inactive">{text.inactive}</option>
            </select>
          </label>
        </div>
        {colors.error ? <AdminFeedback tone="error">{colors.error}</AdminFeedback> : null}
        <div className="admin-form-actions">
          <AdminButton onClick={reset} variant="secondary">{text.cancel}</AdminButton>
          <AdminButton type="submit" variant="brass">{editing ? text.update : text.add}</AdminButton>
        </div>
      </form>

      <AdminPanel title={locale === 'fa' ? 'فهرست رنگ‌ها' : 'Color list'}>
        {colors.colors.length === 0 ? <AdminEmptyState icon="category" title={locale === 'fa' ? 'رنگی وجود ندارد' : 'No colors'} description={locale === 'fa' ? 'اولین رنگ کاتالوگ را با فرم بالا ایجاد کنید.' : 'Create the first catalog color using the form above.'} /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{text.name}</th>
                <th>{text.slug}</th>
                <th>{text.hexCode}</th>
                <th>{text.preview}</th>
                <th>{text.status}</th>
                <th>{text.action}</th>
              </tr>
            </thead>
            <tbody>
              {colors.colors.map((color) => (
                <tr key={color.id}>
                  <td data-label={text.name}><strong>{color.name}</strong></td>
                  <td data-label={text.slug} dir="ltr">{color.slug}</td>
                  <td data-label={text.hexCode} dir="ltr">{color.hexCode ?? '-'}</td>
                  <td data-label={text.preview}><span className="admin-color-preview" style={{ backgroundColor: color.hexCode ?? '#d1d5db' }} /></td>
                  <td data-label={text.status}><StatusBadge locale={locale} value={color.isActive ? 'Active' : 'Inactive'} /></td>
                  <td data-label={text.action}>
                    <div className="admin-row-actions"><AdminButton icon="edit" onClick={() => startEdit(color)} variant="secondary">{text.edit}</AdminButton>
                    <AdminButton icon="trash" onClick={() => void handleDelete(color.id)} variant="danger">{text.delete}</AdminButton></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </AdminPanel>
    </section>
  );
});
