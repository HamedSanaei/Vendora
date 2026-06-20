import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { toast } from 'react-toastify';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminUser } from '../types';

export const AdminProfilePage = observer(function AdminProfilePage() {
  const { users } = useAdminStore();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('Customer');

  function startEdit(user: AdminUser): void {
    setEditing(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhoneNumber(user.phoneNumber ?? '');
    setRole(user.role);
  }

  function reset(): void {
    setEditing(null);
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setRole('Customer');
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editing) {
      return;
    }

    const ok = await users.updateUser(editing.id, { fullName, email, phoneNumber, role });
    if (ok) {
      toast.success('User updated.');
      reset();
    }
  }

  async function handlePasswordReset(user: AdminUser): Promise<void> {
    const message = await users.requestPasswordReset(user.id);
    toast.info(message);
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Users</h1>
        <p>View customers/admins, edit profile data, and request password reset shell actions.</p>
      </div>

      {editing ? (
        <form className="admin-panel admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Phone<input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as AdminUser['role'])}>
                <option value="Customer">Customer</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
          </div>
          {users.error ? <div className="admin-error">{users.error}</div> : null}
          <div className="admin-form-actions">
            <button className="admin-ghost-btn" type="button" onClick={reset}>Cancel</button>
            <button className="admin-primary-btn" type="submit">Save User</button>
          </div>
        </form>
      ) : null}

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.fullName}</strong></td>
                  <td>{user.email}</td>
                  <td>{user.phoneNumber ?? '-'}</td>
                  <td><StatusBadge value={user.role} /></td>
                  <td>
                    <button className="admin-ghost-btn" type="button" onClick={() => startEdit(user)}>Edit</button>
                    <button className="admin-ghost-btn" type="button" onClick={() => void handlePasswordReset(user)}>Reset Password</button>
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
