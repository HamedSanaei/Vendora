import { NavLink, Outlet, useParams } from 'react-router-dom';
import { AdminButton, AdminPageHeader } from '../components/AdminUi';
import { adminPath, normalizeAdminLocale } from '../i18n';
import { sections, sectionLabels } from './model';
import './accounting.css';
import { AccountingDataProvider } from './AccountingDataProvider';

/** Renders the responsive three-primary-tabs plus More navigation from the 390px frame. */
function AccountingMore({ locale }: { locale: 'fa' | 'en' }) {
  return <details className="accounting-more"><summary>{locale === 'fa' ? 'بیشتر' : 'More'} ▾</summary><div>{sections.slice(3).map((section, index) => <NavLink key={section} to={adminPath(locale, `accounting/${section}`)}>{sectionLabels[locale][index + 3]}</NavLink>)}</div></details>;
}

/** Extends the existing admin shell with the eight Penpot accounting tabs; never duplicates navigation/layout. */
export function AccountingPage() {
  const locale = normalizeAdminLocale(useParams().locale);
  const fa = locale === 'fa';
  return <AccountingDataProvider><section className="admin-page admin-accounting">
    <AdminPageHeader eyebrow={fa ? 'وندورا / حسابداری' : 'Vendora / Accounting'} title={fa ? 'حسابداری و گردش موجودی' : 'Accounting & inventory'} description={fa ? 'فاکتورها، ماندهٔ طرف حساب‌ها و ارزش واقعی کالاها' : 'Commercial documents, party balances and inventory valuation'} actions={<><AdminButton to={adminPath(locale, 'accounting/setup')} variant="secondary">{fa ? 'راه‌اندازی' : 'Setup'}</AdminButton><AdminButton to={adminPath(locale, 'accounting/documents/new')} variant="brass">{fa ? 'ثبت فاکتور جدید' : 'New invoice'}</AdminButton></>} />
    <nav className="accounting-tabs" aria-label={fa ? 'بخش‌های حسابداری' : 'Accounting sections'}>{sections.map((section, index) => <NavLink className={index >= 3 ? 'accounting-secondary-tab' : undefined} key={section} end to={adminPath(locale, `accounting${section === 'overview' ? '' : `/${section}`}`)}>{sectionLabels[locale][index]}</NavLink>)}<AccountingMore locale={locale} /></nav>
    <Outlet />
  </section></AccountingDataProvider>;
}
