import type { AdminLocale } from '../i18n';

interface StatusBadgeProps {
  locale?: AdminLocale;
  value: string | number;
}

const persianStatusLabels: Record<string, string> = {
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

function resolveTone(value: string): 'blue' | 'gray' | 'green' | 'red' | 'yellow' {
  if (['active', 'admin', 'delivered', 'instock', 'paid', 'verified'].some((token) => value.includes(token))) return 'green';
  if (['processing', 'redirected', 'shipped', 'packed'].some((token) => value.includes(token))) return 'blue';
  if (['pending', 'lowstock', 'draft'].some((token) => value.includes(token))) return 'yellow';
  if (['cancel', 'failed', 'outofstock', 'refunded'].some((token) => value.includes(token))) return 'red';
  return 'gray';
}

function legacyTone(tone: 'blue' | 'gray' | 'green' | 'red' | 'yellow'): string {
  return tone === 'green' ? 'success' : tone === 'yellow' ? 'warning' : tone === 'red' ? 'danger' : 'info';
}
