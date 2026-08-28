import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AdminButton, AdminEmptyState, AdminFeedback, AdminPageHeader, AdminPanel } from '../components/AdminUi';
import { StatusBadge } from '../components/StatusBadge';
import { normalizeAdminLocale } from '../i18n';
import { useAdminStore } from '../stores/AdminStoreContext';

const copy = {
  fa: {
    title: 'ایمیل‌های ثبت‌شده',
    subtitle: 'ایمیل‌هایی که کاربران در فرم عضویت سایت وارد کرده‌اند را ببینید و CSV دریافت کنید.',
    download: 'دانلود CSV',
    email: 'ایمیل',
    locale: 'زبان',
    status: 'وضعیت',
    createdAt: 'تاریخ ثبت',
    active: 'فعال',
    inactive: 'غیرفعال',
    empty: 'هنوز ایمیلی ثبت نشده است.',
  },
  en: {
    title: 'Email Subscribers',
    subtitle: 'View storefront newsletter emails and download them as CSV.',
    download: 'Download CSV',
    email: 'Email',
    locale: 'Locale',
    status: 'Status',
    createdAt: 'Created',
    active: 'Active',
    inactive: 'Inactive',
    empty: 'No emails have been submitted yet.',
  },
} as const;

/** Renders the admin email subscriber list and CSV export action. */
export const AdminNewsletterPage = observer(function AdminNewsletterPage() {
  const { newsletter } = useAdminStore();
  const params = useParams();
  const locale = normalizeAdminLocale(params.locale);
  const text = copy[locale];

  useEffect(() => {
    void newsletter.loadSubscriptions();
  }, [newsletter]);

  async function handleDownload(): Promise<void> {
    const blob = await newsletter.downloadCsv();
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'newsletter-subscriptions.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-page">
      <AdminPageHeader eyebrow={locale === 'fa' ? 'رشد و ارتباط با مشتری' : 'Customer growth'} title={text.title} description={text.subtitle} actions={<AdminButton icon="download" onClick={() => void handleDownload()} variant="brass">{text.download}</AdminButton>} />

      <AdminPanel title={locale === 'fa' ? 'فهرست عضویت‌ها' : 'Subscription list'} description={`${newsletter.subscriptions.length.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')} ${locale === 'fa' ? 'ایمیل' : 'emails'}`}>
        {newsletter.error ? <AdminFeedback tone="error">{newsletter.error}</AdminFeedback> : null}
        {newsletter.subscriptions.length === 0 ? <AdminEmptyState icon="newsletter" title={text.empty} description={locale === 'fa' ? 'ایمیل‌های ثبت‌شده در فرم خبرنامه فروشگاه اینجا نمایش داده می‌شوند.' : 'Storefront newsletter signups appear here.'} /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{text.email}</th>
                <th>{text.locale}</th>
                <th>{text.status}</th>
                <th>{text.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {newsletter.subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td data-label={text.email}><strong dir="ltr">{subscription.email}</strong></td>
                  <td data-label={text.locale}>{subscription.sourceLocale ?? '-'}</td>
                  <td data-label={text.status}><StatusBadge locale={locale} value={subscription.isActive ? 'Active' : 'Inactive'} /></td>
                  <td data-label={text.createdAt}>{new Date(subscription.createdAtUtc).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</td>
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
