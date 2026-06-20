import { mockStaff } from '../data/mockAdminData';

export function AdminStaffPage() {
  return (
    <section className="admin-page">
      <div className="admin-page-title admin-title-row">
        <div>
          <h1>Our Staff</h1>
          <p>Staff management shell prepared for future admin user APIs</p>
        </div>
        <button className="admin-primary-btn" type="button">Add Staff</button>
      </div>

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mockStaff.map((staff) => (
                <tr key={staff.id}>
                  <td><strong>{staff.name}</strong></td>
                  <td>{staff.email}</td>
                  <td>{staff.role}</td>
                  <td><button className="admin-ghost-btn" type="button">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
