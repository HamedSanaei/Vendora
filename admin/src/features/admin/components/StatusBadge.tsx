import type { AdminLocale } from '../i18n';

interface StatusBadgeProps {
  locale?: AdminLocale;
  value: string | number;
}

const persianStatusLabels: Record<string, string> = {
  queued: 'در صف',
  sending: 'در حال ارسال',
  accepted: 'پذیرفته‌شده در سامانه',
  unknown: 'نامشخص',
  closed: 'بسته',
  waitingforsupport: 'منتظر پشتیبانی',
  waitingforcustomer: 'منتظر مشتری',
  active: 'فعال',
  admin: 'مدیر',
  archived: 'آرشیو',
  cancelled: 'لغوشده',
  customer: 'مشتری',
  delivered: 'تحویل‌شده',
  draft: 'پیش‌نویس',
  failed: 'ناموفق',
  inactive: 'غیرفعال',
  instock: 'موجود',
  lowstock: 'رو به اتمام',
  outofstock: 'ناموجود',
  packed: 'بسته‌بندی‌شده',
  paid: 'پرداخت‌شده',
  pending: 'در انتظار',
  pendingpayment: 'در انتظار پرداخت',
  processing: 'در حال پردازش',
  redirected: 'ارسال به درگاه',
  refunded: 'بازپرداخت‌شده',
  shipped: 'ارسال‌شده',
  verified: 'تأییدشده',
};

/** Renders the reusable localized Penpot status component with a semantic tone. */
export function StatusBadge({ locale = 'fa', value }: StatusBadgeProps) {
  const rawLabel = String(value);
  const normalized = rawLabel.toLowerCase().replace(/\s+/g, '');
  const label = locale === 'fa' ? (persianStatusLabels[normalized] ?? rawLabel) : rawLabel;
  const tone = resolveTone(normalized);

  return <span className={`admin-badge admin-badge-${tone} admin-badge-${legacyTone(tone)}`}>{label}</span>;
}

/** Uses exact domain states so inactive/unpaid/unknown values cannot inherit a positive substring match. */
function resolveTone(value: string): 'blue' | 'gray' | 'green' | 'red' | 'yellow' {
  if (['active', 'admin', 'delivered', 'instock', 'paid', 'verified'].includes(value)) return 'green';
  if (['processing', 'redirected', 'shipped', 'packed', 'accepted', 'sending', 'waitingforcustomer'].includes(value)) return 'blue';
  if (['pending', 'pendingpayment', 'lowstock', 'draft', 'queued', 'waitingforsupport'].includes(value)) return 'yellow';
  if (['cancel', 'cancelled', 'canceled', 'failed', 'outofstock', 'refunded'].includes(value)) return 'red';
  return 'gray';
}

/** Preserves legacy English badge variants without applying the blue/info variant to neutral states. */
function legacyTone(tone: 'blue' | 'gray' | 'green' | 'red' | 'yellow'): string {
  return tone === 'green' ? 'success' : tone === 'yellow' ? 'warning' : tone === 'red' ? 'danger' : tone === 'gray' ? 'neutral' : 'info';
}
