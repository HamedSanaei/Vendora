import { observer } from 'mobx-react-lite';
import { type FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';
import type { AdminCoupon } from '../types';
import { formatDate, formatMoney, formatNumberInput, parseNumberInput } from '../utils/formatters';

/** Manages real percentage coupons, caps, expiry, and category restrictions. */
export const AdminCouponsPage = observer(function AdminCouponsPage() {
  const { coupons, products } = useAdminStore();
  const locale = normalizeAdminLocale(useParams().locale);
  const isFa = locale === 'fa';
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [title, setTitle] = useState(''); const [code, setCode] = useState(''); const [discountPercent, setDiscountPercent] = useState('10'); const [maxDiscountAmount, setMaxDiscountAmount] = useState(''); const [expiresAtUtc, setExpiresAtUtc] = useState(''); const [isActive, setIsActive] = useState(true); const [appliesToAllCategories, setAppliesToAllCategories] = useState(true); const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => { void Promise.all([coupons.loadCoupons(), products.loadCategoryOptions()]); }, [coupons, products]);

  function reset(): void { setEditing(null); setTitle(''); setCode(''); setDiscountPercent('10'); setMaxDiscountAmount(''); setExpiresAtUtc(''); setIsActive(true); setAppliesToAllCategories(true); setCategoryIds([]); }
  function startEdit(coupon: AdminCoupon): void { setEditing(coupon); setTitle(coupon.title); setCode(coupon.code); setDiscountPercent(String(coupon.discountPercent)); setMaxDiscountAmount(coupon.maxDiscountAmount ? formatNumberInput(String(coupon.maxDiscountAmount), locale) : ''); setExpiresAtUtc(coupon.expiresAtUtc.slice(0, 10)); setIsActive(coupon.isActive); setAppliesToAllCategories(coupon.appliesToAllCategories); setCategoryIds(coupon.categoryIds); }
  async function handleSubmit(event: FormEvent): Promise<void> { event.preventDefault(); const input = { title, code, discountPercent: Number(discountPercent), maxDiscountAmount: maxDiscountAmount ? parseNumberInput(maxDiscountAmount) : null, expiresAtUtc: new Date(expiresAtUtc).toISOString(), isActive, appliesToAllCategories, categoryIds: appliesToAllCategories ? [] : categoryIds }; const ok = editing ? await coupons.updateCoupon(editing.id, input) : await coupons.createCoupon(input); if (ok) { toast.success(isFa ? (editing ? 'کد تخفیف به‌روزرسانی شد.' : 'کد تخفیف ایجاد شد.') : (editing ? 'Coupon updated.' : 'Coupon created.')); reset(); } }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={isFa ? 'کمپین‌های فروش' : 'Sales campaigns'} title={isFa ? 'کدهای تخفیف' : 'Coupons'} description={isFa ? 'درصد، سقف مبلغ، تاریخ انقضا و محدودیت دسته‌بندی را کنترل کنید.' : 'Control percentage, cap, expiry, and category restrictions.'} />
      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label>{isFa ? 'عنوان' : 'Title'}<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>{isFa ? 'کد' : 'Code'}<input dir="ltr" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label><label>{isFa ? 'درصد تخفیف' : 'Discount percent'}<input type="number" min="1" max="100" required value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} /></label><label>{isFa ? 'سقف تخفیف (تومان)' : 'Max discount (Toman)'}<input inputMode="numeric" value={maxDiscountAmount} onChange={(event) => setMaxDiscountAmount(formatNumberInput(event.target.value, locale))} /></label><label>{isFa ? 'تاریخ انقضا' : 'Expires at'}<input type="date" required value={expiresAtUtc} onChange={(event) => setExpiresAtUtc(event.target.value)} /></label><label>{isFa ? 'وضعیت' : 'Status'}<select value={isActive ? 'active' : 'inactive'} onChange={(event) => setIsActive(event.target.value === 'active')}><option value="active">{isFa ? 'فعال' : 'Active'}</option><option value="inactive">{isFa ? 'غیرفعال' : 'Inactive'}</option></select></label><label>{isFa ? 'دامنه اعمال' : 'Applies to'}<select value={appliesToAllCategories ? 'all' : 'custom'} onChange={(event) => setAppliesToAllCategories(event.target.value === 'all')}><option value="all">{isFa ? 'همه دسته‌بندی‌ها' : 'All categories'}</option><option value="custom">{isFa ? 'دسته‌بندی‌های انتخابی' : 'Selected categories'}</option></select></label>
          {!appliesToAllCategories ? <label>{isFa ? 'دسته‌بندی‌ها' : 'Categories'}<select multiple value={categoryIds} onChange={(event) => setCategoryIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{products.categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        </div>
        {coupons.error ? <AdminFeedback tone="error">{coupons.error}</AdminFeedback> : null}
        <div className="admin-form-actions"><AdminButton onClick={reset} variant="secondary">{isFa ? 'انصراف' : 'Cancel'}</AdminButton><AdminButton type="submit" variant="brass">{isFa ? (editing ? 'ذخیره کد' : 'افزودن کد تخفیف') : (editing ? 'Update coupon' : 'Add coupon')}</AdminButton></div>
      </form>
      <AdminPanel title={isFa ? 'فهرست کدها' : 'Coupon list'}>
        {coupons.coupons.length === 0 ? <AdminEmptyState icon="coupon" title={isFa ? 'کد تخفیفی وجود ندارد' : 'No coupons'} description={isFa ? 'برای اولین کمپین، فرم بالا را تکمیل کنید.' : 'Complete the form above for the first campaign.'} /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{isFa ? 'کد' : 'Code'}</th><th>{isFa ? 'تخفیف' : 'Discount'}</th><th>{isFa ? 'سقف' : 'Cap'}</th><th>{isFa ? 'دسته‌بندی' : 'Categories'}</th><th>{isFa ? 'انقضا' : 'Expires'}</th><th>{isFa ? 'وضعیت' : 'Status'}</th><th>{isFa ? 'عملیات' : 'Action'}</th></tr></thead><tbody>{coupons.coupons.map((coupon) => <tr key={coupon.id}><td data-label={isFa ? 'کد' : 'Code'}><strong dir="ltr">{coupon.code}</strong><small>{coupon.title}</small></td><td data-label={isFa ? 'تخفیف' : 'Discount'}>{coupon.discountPercent.toLocaleString(isFa ? 'fa-IR' : 'en-US')}٪</td><td data-label={isFa ? 'سقف' : 'Cap'}>{coupon.maxDiscountAmount ? formatMoney(coupon.maxDiscountAmount, locale) : '—'}</td><td data-label={isFa ? 'دسته‌بندی' : 'Categories'}>{coupon.appliesToAllCategories ? (isFa ? 'همه دسته‌ها' : 'All categories') : coupon.categoryNames.join('، ')}</td><td data-label={isFa ? 'انقضا' : 'Expires'}>{formatDate(coupon.expiresAtUtc, locale)}</td><td data-label={isFa ? 'وضعیت' : 'Status'}><StatusBadge locale={locale} value={coupon.isActive ? 'Active' : 'Inactive'} /></td><td data-label={isFa ? 'عملیات' : 'Action'}><div className="admin-row-actions"><AdminButton icon="edit" onClick={() => startEdit(coupon)} variant="secondary">{isFa ? 'ویرایش' : 'Edit'}</AdminButton><AdminButton icon="trash" onClick={() => void coupons.deleteCoupon(coupon.id)} variant="danger">{isFa ? 'حذف' : 'Delete'}</AdminButton></div></td></tr>)}</tbody></table></div>}
      </AdminPanel>
    </section>
  );
});
