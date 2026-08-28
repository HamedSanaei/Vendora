import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';

/** Projects real Admin-role users into the Penpot team screen without inventing unsupported roles. */
export const AdminStaffPage = observer(function AdminStaffPage() {
  const { users } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const staff = users.users.filter((user) => user.role === 'Admin');

  useEffect(() => { void users.loadUsers(); }, [users]);

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow={isFa ? 'دسترسی مدیریتی' : 'Administrative access'}
        title={isFa ? 'تیم وندورا' : 'Vendora team'}
        description={isFa ? 'این فهرست مستقیماً از کاربران دارای نقش Admin ساخته می‌شود.' : 'This list is projected directly from users with the Admin role.'}
        actions={<AdminButton icon="users" to={`${adminPath(locale, 'profile')}?role=Admin`} variant="brass">{isFa ? 'مدیریت دسترسی‌ها' : 'Manage access'}</AdminButton>}
      />
      <AdminFeedback tone="info">{isFa ? 'نقش‌های Owner و Manager تا زمانی که در Backend تعریف نشوند نمایش داده نمی‌شوند؛ این صفحه فقط داده واقعی را نشان می‌دهد.' : 'Owner and Manager are not displayed until supported by the Backend; this screen only shows real data.'}</AdminFeedback>
      {users.error ? <AdminFeedback tone="error">{users.error}</AdminFeedback> : null}
      <AdminPanel title={isFa ? 'مدیران فعال' : 'Administrators'} description={`${staff.length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} ${isFa ? 'عضو' : 'members'}`}>
        {staff.length === 0 ? <AdminEmptyState icon="staff" title={isFa ? 'مدیری ثبت نشده' : 'No administrators'} description={isFa ? 'از صفحه کاربران، نقش یک حساب را به Admin تغییر دهید.' : 'Promote a user to Admin from the user management screen.'} /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{isFa ? 'نام' : 'Name'}</th><th>{isFa ? 'ایمیل' : 'Email'}</th><th>{isFa ? 'تلفن' : 'Phone'}</th><th>{isFa ? 'نقش' : 'Role'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td data-label={isFa ? 'نام' : 'Name'}><strong>{member.fullName}</strong></td><td data-label={isFa ? 'ایمیل' : 'Email'} dir="ltr">{member.email}</td><td data-label={isFa ? 'تلفن' : 'Phone'} dir="ltr">{member.phoneNumber ?? '—'}</td><td data-label={isFa ? 'نقش' : 'Role'}><StatusBadge locale={locale} value="Admin" /></td><td data-label={isFa ? 'عملیات' : 'Action'}><AdminButton icon="edit" to={`${adminPath(locale, 'profile')}?role=Admin&q=${encodeURIComponent(member.email)}`} variant="secondary">{isFa ? 'ویرایش دسترسی' : 'Edit access'}</AdminButton></td></tr>)}</tbody></table></div>}
      </AdminPanel>
    </section>
  );
});
