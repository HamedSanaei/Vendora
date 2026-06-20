import { observer } from 'mobx-react-lite';
import { type FormEvent, useState } from 'react';
import { toast } from 'react-toastify';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminCoupon } from '../types';
import { formatDate, formatMoney, formatNumberInput, parseNumberInput } from '../utils/formatters';

export const AdminCouponsPage = observer(function AdminCouponsPage() {
  const { coupons, products } = useAdminStore();
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [expiresAtUtc, setExpiresAtUtc] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [appliesToAllCategories, setAppliesToAllCategories] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  function reset(): void {
    setEditing(null);
    setTitle('');
    setCode('');
    setDiscountPercent('10');
    setMaxDiscountAmount('');
    setExpiresAtUtc('');
    setIsActive(true);
    setAppliesToAllCategories(true);
    setCategoryIds([]);
  }

  function startEdit(coupon: AdminCoupon): void {
    setEditing(coupon);
    setTitle(coupon.title);
    setCode(coupon.code);
    setDiscountPercent(String(coupon.discountPercent));
    setMaxDiscountAmount(coupon.maxDiscountAmount ? formatNumberInput(String(coupon.maxDiscountAmount)) : '');
    setExpiresAtUtc(coupon.expiresAtUtc.slice(0, 10));
    setIsActive(coupon.isActive);
    setAppliesToAllCategories(coupon.appliesToAllCategories);
    setCategoryIds(coupon.categoryIds);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const input = {
      title,
      code,
      discountPercent: Number(discountPercent),
      maxDiscountAmount: maxDiscountAmount ? parseNumberInput(maxDiscountAmount) : null,
      expiresAtUtc: new Date(expiresAtUtc).toISOString(),
      isActive,
      appliesToAllCategories,
      categoryIds: appliesToAllCategories ? [] : categoryIds,
    };

    const ok = editing ? await coupons.updateCoupon(editing.id, input) : await coupons.createCoupon(input);
    if (ok) {
      toast.success(editing ? 'Coupon updated.' : 'Coupon created.');
      reset();
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>Coupons</h1>
        <p>Create percentage coupons with Toman cap and category restrictions.</p>
      </div>

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
          <label>Discount percent<input type="number" min="1" max="100" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} /></label>
          <label>
            Max discount (Toman)
            <input value={maxDiscountAmount} onChange={(event) => setMaxDiscountAmount(formatNumberInput(event.target.value))} />
          </label>
          <label>Expires at<input type="date" value={expiresAtUtc} onChange={(event) => setExpiresAtUtc(event.target.value)} /></label>
          <label>
            Status
            <select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Applies to
            <select value={appliesToAllCategories ? 'all' : 'custom'} onChange={(event) => setAppliesToAllCategories(event.target.value === 'all')}>
              <option value="all">All categories</option>
              <option value="custom">Selected categories</option>
            </select>
          </label>
          {!appliesToAllCategories ? (
            <label>
              Categories
              <select multiple value={categoryIds} onChange={(event) => setCategoryIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>
                {products.categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {coupons.error ? <div className="admin-error">{coupons.error}</div> : null}
        <div className="admin-form-actions">
          <button className="admin-ghost-btn" type="button" onClick={reset}>Cancel</button>
          <button className="admin-primary-btn" type="submit">{editing ? 'Update Coupon' : 'Add Coupon'}</button>
        </div>
      </form>

      <article className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Cap</th>
                <th>Categories</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td><strong>{coupon.code}</strong><small>{coupon.title}</small></td>
                  <td>{coupon.discountPercent}%</td>
                  <td>{coupon.maxDiscountAmount ? formatMoney(coupon.maxDiscountAmount) : '-'}</td>
                  <td>{coupon.appliesToAllCategories ? 'All categories' : coupon.categoryNames.join(', ')}</td>
                  <td>{formatDate(coupon.expiresAtUtc)}</td>
                  <td><StatusBadge value={coupon.isActive ? 'Active' : 'Inactive'} /></td>
                  <td>
                    <button className="admin-ghost-btn" type="button" onClick={() => startEdit(coupon)}>Edit</button>
                    <button className="admin-danger-btn" type="button" onClick={() => void coupons.deleteCoupon(coupon.id)}>Delete</button>
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
