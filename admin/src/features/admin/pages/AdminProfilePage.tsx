import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminFilterBar, AdminPageHeader, AdminPagination, AdminPanel, AdminPermissionBanner } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminUser } from '../types';

/** Manages persisted customer/admin profiles while making unavailable auth actions explicit. */
export const AdminProfilePage = observer(function AdminProfilePage() {
  const { users } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [phoneNumber, setPhoneNumber] = useState(''); const [role, setRole] = useState<AdminUser['role']>('Customer');
  const query = searchParams.get('q') ?? ''; const roleFilter = searchParams.get('role') ?? 'all'; const requestedPage = Number(searchParams.get('page') ?? '1');

  useEffect(() => { void users.loadUsers(); }, [users]);

  const filteredUsers = useMemo(() => users.users.filter((user) => {
    const normalized = query.trim().toLocaleLowerCase();
    return (!normalized || `${user.fullName} ${user.email} ${user.phoneNumber ?? ''}`.toLocaleLowerCase().includes(normalized)) && (roleFilter === 'all' || user.role === roleFilter);
  }), [query, roleFilter, users.users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 10)); const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages); const pageItems = filteredUsers.slice((page - 1) * 10, page * 10);

  function updateParam(key: string, value: string, resetPage = true): void { const next = new URLSearchParams(searchParams); if (!value || value === 'all') next.delete(key); else next.set(key, value); if (resetPage) next.delete('page'); setSearchParams(next, { replace: true }); }
  function startEdit(user: AdminUser): void { setEditing(user); setFullName(user.fullName); setEmail(user.email); setPhoneNumber(user.phoneNumber ?? ''); setRole(user.role); }
  function reset(): void { setEditing(null); setFullName(''); setEmail(''); setPhoneNumber(''); setRole('Customer'); }
  async function handleSubmit(event: FormEvent): Promise<void> { event.preventDefault(); if (!editing) return; const ok = await users.updateUser(editing.id, { fullName, email, phoneNumber, role }); if (ok) { toast.success(isFa ? 'اطلاعات کاربر ذخیره شد.' : 'User updated.'); reset(); } }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'مشتریان و دسترسی‌ها' : 'Customers and access'} title={isFa ? 'کاربران' : 'Users'} description={isFa ? 'اطلاعات تماس و نقش‌های Customer/Admin را مدیریت کنید.' : 'Manage contact information and Customer/Admin roles.'} />
      <AdminPermissionBanner title={isFa ? 'محدودیت سرویس احراز هویت' : 'Authentication service limitation'}>{isFa ? 'ارسال لینک بازنشانی رمز هنوز به سرویس احراز هویت متصل نشده و تا آن زمان غیرفعال است.' : 'Password reset delivery is not connected to an auth provider and remains disabled.'}</AdminPermissionBanner>
      {users.error ? <AdminFeedback tone="error">{users.error}</AdminFeedback> : null}

      {editing ? <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-surface-header"><div><h2>{isFa ? 'ویرایش کاربر' : 'Edit user'}</h2><p>{editing.email}</p></div></div>
        <div className="admin-form-grid"><label>{isFa ? 'نام کامل' : 'Full name'}<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label>{isFa ? 'ایمیل' : 'Email'}<input dir="ltr" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{isFa ? 'شماره تماس' : 'Phone'}<input dir="ltr" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label><label>{isFa ? 'نقش' : 'Role'}<select value={role} onChange={(event) => setRole(event.target.value as AdminUser['role'])}><option value="Customer">{isFa ? 'مشتری' : 'Customer'}</option><option value="Admin">{isFa ? 'مدیر' : 'Admin'}</option></select></label></div>
        <div className="admin-form-actions"><AdminButton onClick={reset} variant="secondary">{isFa ? 'انصراف' : 'Cancel'}</AdminButton><AdminButton type="submit" variant="brass">{isFa ? 'ذخیره کاربر' : 'Save user'}</AdminButton></div>
      </form> : null}

      <AdminPanel title={isFa ? 'فهرست کاربران' : 'User list'} description={`${filteredUsers.length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} ${isFa ? 'کاربر' : 'users'}`}>
        <AdminFilterBar searchLabel={isFa ? 'جستجو با نام، ایمیل یا تلفن…' : 'Search name, email, or phone…'} searchValue={query} onSearchChange={(value) => updateParam('q', value)}><select className="admin-filter-select" value={roleFilter} onChange={(event) => updateParam('role', event.target.value)}><option value="all">{isFa ? 'همه نقش‌ها' : 'All roles'}</option><option value="Customer">{isFa ? 'مشتریان' : 'Customers'}</option><option value="Admin">{isFa ? 'مدیران' : 'Admins'}</option></select></AdminFilterBar>
        {pageItems.length === 0 ? <AdminEmptyState icon="users" title={isFa ? 'کاربری پیدا نشد' : 'No users found'} description={isFa ? 'عبارت جستجو یا فیلتر نقش را تغییر دهید.' : 'Adjust the search or role filter.'} /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{isFa ? 'نام' : 'Name'}</th><th>{isFa ? 'ایمیل' : 'Email'}</th><th>{isFa ? 'تلفن' : 'Phone'}</th><th>{isFa ? 'نقش' : 'Role'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead><tbody>{pageItems.map((user) => <tr key={user.id}><td data-label={isFa ? 'نام' : 'Name'}><strong>{user.fullName}</strong></td><td data-label={isFa ? 'ایمیل' : 'Email'} dir="ltr">{user.email}</td><td data-label={isFa ? 'تلفن' : 'Phone'} dir="ltr">{user.phoneNumber ?? '—'}</td><td data-label={isFa ? 'نقش' : 'Role'}><StatusBadge locale={locale} value={user.role} /></td><td data-label={isFa ? 'عملیات' : 'Action'}><div className="admin-row-actions"><AdminButton icon="edit" onClick={() => startEdit(user)} variant="secondary">{isFa ? 'ویرایش' : 'Edit'}</AdminButton><AdminButton disabled title={isFa ? 'سرویس بازنشانی هنوز متصل نیست' : 'Reset provider is not connected'} variant="ghost">{isFa ? 'بازنشانی رمز' : 'Reset password'}</AdminButton></div></td></tr>)}</tbody></table></div>}
        <AdminPagination currentPage={page} label={isFa ? 'صفحه‌بندی کاربران' : 'User pagination'} locale={locale} onPageChange={(value) => updateParam('page', String(value), false)} totalPages={totalPages} />
      </AdminPanel>
    </section>
  );
});
