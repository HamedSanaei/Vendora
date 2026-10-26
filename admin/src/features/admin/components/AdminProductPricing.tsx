import { readShippingSettings } from "../api/shippingApi";
import { useEffect, useState } from 'react';
import { getInternalExchangeRate } from '../api/adminApi';
import { AdminSelect } from './AdminUi';
import type { AdminLocale } from '../i18n';
import type { InternalExchangeRate } from '../types';
import { formatMoney, formatNumberInput, normalizeDigits } from '../utils/formatters';

interface AdminProductPricingProps {
  locale: AdminLocale;
  mode: 'toman' | 'usd';
  value: string;
  onModeChange: (mode: 'toman' | 'usd') => void;
  onChange: (value: string) => void;
}

/** Product pricing inputs and an informational preview based solely on the persisted internal rate. */
export function AdminProductPricing({ locale, mode, value, onModeChange, onChange }: AdminProductPricingProps) {
  const isFa = locale === 'fa';
  const [rate, setRate] = useState<InternalExchangeRate | null>(null);
  const [shippingAmount, setShippingAmount] = useState(0);
  useEffect(() => { let active = true; readShippingSettings().then(value => { if (active) setShippingAmount(value.policy.includedInPrice ? value.policy.unitAmount : 0); }).catch(() => undefined); return () => { active = false; }; }, []);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getInternalExchangeRate().then((result) => { if (!cancelled) setRate(result); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  const usd = Number(normalizeDigits(value).replaceAll(',', ''));
  const preview = rate?.tomanPerUsdt && usd > 0 ? Math.ceil(usd * rate.tomanPerUsdt / 10000) * 10000 : null;

  return (
    <>
      <AdminSelect label={isFa ? 'مبنای قیمت' : 'Pricing basis'} value={mode}
        onChange={(event) => onModeChange(event.target.value as 'toman' | 'usd')}>
        <option value="toman">{isFa ? 'قیمت ثابت تومانی' : 'Fixed Toman price'}</option>
        <option value="usd">{isFa ? 'قیمت دلاری با نرخ تتر سیستم' : 'Dollar price using internal USDT rate'}</option>
      </AdminSelect>
      <label>
        {mode === 'usd' ? (isFa ? 'قیمت پایه (دلار)' : 'Base price (USD)') : (isFa ? 'قیمت (تومان)' : 'Price (Toman)')}
        <input name={mode === 'usd' ? 'usdPrice' : 'price'} inputMode={mode === 'usd' ? 'decimal' : 'numeric'}
          value={value} placeholder={mode === 'usd' ? '3.25' : '1,250,000'}
          onChange={(event) => onChange(mode === 'usd' ? normalizeDigits(event.target.value).replace('٫', '.') : formatNumberInput(event.target.value, locale))} />
      </label>
      <p className="admin-form-full">{isFa ? 'پیش‌نمایش قیمت فروش (با سهم ارسال): ' : 'Retail price preview (including shipping): '}{formatMoney((mode === 'usd' ? preview ?? 0 : Number(normalizeDigits(value).replaceAll(',', '')) || 0) + shippingAmount, locale)}</p>
      {mode === 'usd' && (
        <div className="admin-form-full" role="status">
          <p>{preview !== null
            ? `${isFa ? 'معادل تومانی، گرد شده رو به بالا: ' : 'Rounded Toman preview: '}${formatMoney(preview, locale)}`
            : (isFa ? 'تا دریافت نرخ معتبر داخلی، ذخیرهٔ قیمت دلاری امکان‌پذیر نیست.' : 'A valid internal rate is required before saving dollar prices.')}</p>
          {rate?.tomanPerUsdt && <small>{isFa ? 'نرخ داخلی هر تتر: ' : 'Internal USDT rate: '}{formatMoney(rate.tomanPerUsdt, locale)}
            {rate.updatedAtUtc && ` · ${new Intl.DateTimeFormat(isFa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(rate.updatedAtUtc))}`}</small>}
          <p><small>{isFa ? 'نرخ هر ۳۰ دقیقه به‌روزرسانی می‌شود. مبلغ نهایی را سرور محاسبه می‌کند.' : 'The rate refreshes every 30 minutes. The server calculates the final price.'}</small></p>
          {(failed || rate?.lastError) && <p role="alert">{isFa ? 'به‌روزرسانی نرخ در دسترس نیست؛ آخرین نرخ معتبر داخلی حفظ می‌شود.' : 'Rate refresh is unavailable; the last valid internal rate is retained.'}</p>}
        </div>
      )}
    </>
  );
}
