"use client";

import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { CheckIcon, ClockIcon, PinIcon, TruckIcon, WarningIcon } from "@/components/vendora/icons";
import { SelectField, TextField, TextareaField } from "@/components/vendora/ui/form-field";
import { formatPrice } from "@/lib/vendora/format";
import { getShippingDeliveryTime, getShippingMethodTitle, type ShippingMethod } from "@/lib/vendora/shipping";
import type { Locale } from "@/lib/vendora/types";

export interface ShippingAddressView {
  id: string;
  title?: string;
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  streetAddress: string;
  plaque?: string | null;
  unit?: string | null;
  postalCode: string;
  isDefault?: boolean;
}

export interface ShippingAddressFormValues {
  title: string;
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  streetAddress: string;
  plaque: string;
  unit: string;
  postalCode: string;
  email: string;
  isDefault: boolean;
  notes: string;
}

interface AddressOptionProps {
  address: ShippingAddressView;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
}

/** Selectable saved-address card matching the Shipping Penpot component. */
export function AddressOption({ address, locale, selected, onSelect }: AddressOptionProps) {
  const title = address.title || address.recipientName;
  const addressLine = [address.province, address.city, address.streetAddress].filter(Boolean).join("، ");
  return (
    <label className={`vd-focus group flex min-h-[124px] cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition-colors ${selected ? "border-jade bg-jade-tint" : "border-vd-line bg-white hover:border-jade"}`}>
      <input type="radio" name="shipping-address" checked={selected} onChange={onSelect} className="sr-only" />
      <span aria-hidden className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-jade bg-jade" : "border-vd-line bg-white"}`}>
        {selected ? <CheckIcon size={13} className="text-white" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-ink">
          <PinIcon size={17} className={selected ? "text-jade" : "text-vd-muted"} />
          {title}
          {address.isDefault ? <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-jade">{locale === "fa" ? "پیش‌فرض" : "Default"}</span> : null}
        </span>
        <span className="mt-2 block line-clamp-2 text-xs leading-6 text-vd-muted">{addressLine}</span>
        <span className="mt-1 block text-xs text-vd-muted" dir="ltr">{address.phoneNumber} · {address.postalCode}</span>
      </span>
    </label>
  );
}

interface ShippingMethodCardProps {
  method: ShippingMethod;
  locale: Locale;
  selected: boolean;
  onSelect: () => void;
}

/** Shipping method card with prepaid/collect state and an accessible radio. */
export function ShippingMethodCard({ method, locale, selected, onSelect }: ShippingMethodCardProps) {
  const isFa = locale === "fa";
  const collect = method.paymentMode === "collect";
  return (
    <label className={`vd-focus group flex min-h-[124px] cursor-pointer items-center gap-3 rounded-[18px] border p-4 transition-colors ${selected ? "border-jade bg-jade-tint" : "border-vd-line bg-white hover:border-jade"}`}>
      <input type="radio" name="shipping-method" checked={selected} onChange={onSelect} className="sr-only" />
      <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-jade bg-jade" : "border-vd-line bg-white"}`}>
        {selected ? <CheckIcon size={13} className="text-white" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${collect ? "bg-vd-warning-tint text-vd-warning" : "bg-jade-tint text-jade"}`}>
          {collect ? <TruckIcon size={21} /> : <ClockIcon size={21} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-ink">{getShippingMethodTitle(method, locale)}</span>
          <span className="mt-1 block text-xs text-vd-muted">{getShippingDeliveryTime(method, locale)}</span>
          <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${collect ? "bg-vd-warning-tint text-vd-warning" : "bg-jade-tint text-jade"}`}>
            {collect ? (isFa ? "پس‌پرداخت کرایه" : "Pay on delivery") : (isFa ? "پیش‌پرداخت کرایه" : "Prepaid shipping")}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-end text-xs font-extrabold text-ink">
        {collect ? <><span className="block text-vd-warning">{isFa ? "پرداخت هنگام تحویل" : "Pay on delivery"}</span><span className="mt-1 block text-[10px] font-semibold text-vd-muted">{isFa ? "محاسبه توسط باربری" : "Calculated by carrier"}</span></> : formatPrice(method.cost, locale)}
      </span>
    </label>
  );
}

interface OrderSummaryProps {
  locale: Locale;
  subtotal: number;
  discount?: number;
  shippingMethod?: ShippingMethod | null;
  action?: ReactNode;
}

/** Sticky checkout summary shared by Shipping and the payment handoff. */
export function OrderSummary({ locale, subtotal, discount = 0, shippingMethod, action }: OrderSummaryProps) {
  const isFa = locale === "fa";
  const shippingCost = shippingMethod?.paymentMode === "prepaid" ? shippingMethod.cost : 0;
  const payable = Math.max(0, subtotal + shippingCost - discount);
  return (
    <aside className="rounded-[20px] border border-vd-line bg-white p-5 shadow-[0_18px_50px_-40px_rgba(0,77,58,.85)] lg:sticky lg:top-5 lg:p-6">
      <h2 className="text-lg font-extrabold text-ink">{isFa ? "خلاصه سفارش" : "Order summary"}</h2>
      <hr className="my-5 border-vd-line" />
      <dl className="space-y-4 text-sm">
        <SummaryLine label={isFa ? "جمع کالاها" : "Items subtotal"} value={formatPrice(subtotal, locale)} />
        <SummaryLine label={isFa ? "تخفیف" : "Discount"} value={discount ? `− ${formatPrice(discount, locale)}` : formatPrice(0, locale)} muted />
        <SummaryLine label={isFa ? "هزینه ارسال" : "Shipping"} value={shippingMethod?.paymentMode === "collect" ? (isFa ? "پرداخت هنگام تحویل" : "Pay on delivery") : shippingMethod ? formatPrice(shippingCost, locale) : (isFa ? "انتخاب نشده" : "Not selected")} accent={Boolean(shippingMethod)} />
      </dl>
      <hr className="my-5 border-vd-line" />
      <div className="flex items-center justify-between gap-3"><span className="font-extrabold text-ink">{isFa ? "مبلغ قابل پرداخت" : "Payable now"}</span><strong className="text-lg font-extrabold text-jade-dark">{formatPrice(payable, locale)}</strong></div>
      {shippingMethod?.paymentMode === "collect" ? <p className="mt-3 flex items-start gap-2 rounded-control bg-vd-warning-tint p-3 text-xs leading-6 text-vd-warning"><WarningIcon size={16} className="mt-1 shrink-0" />{isFa ? "کرایه باربری هنگام تحویل جداگانه دریافت می‌شود." : "The carrier collects shipping charges on delivery."}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </aside>
  );
}

interface NewAddressPanelProps {
  locale: Locale;
  register: UseFormRegister<ShippingAddressFormValues>;
  errors: FieldErrors<ShippingAddressFormValues>;
}

/** Expandable shipping-address form shared by empty and explicit new-address states. */
export function NewAddressPanel({ locale, register, errors }: NewAddressPanelProps) {
  const isFa = locale === "fa";
  return (
    <div className="mt-6 border-t border-vd-line pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink">{isFa ? "افزودن آدرس جدید" : "Add a new address"}</h3>
          <p className="mt-1 text-xs text-vd-muted">{isFa ? "اطلاعات را دقیق وارد کنید تا ارسال سریع‌تر انجام شود." : "Complete details help us deliver faster."}</p>
        </div>
        <span className="rounded-full bg-jade-tint px-2.5 py-1 text-[10px] font-bold text-jade">{isFa ? "الزامی" : "Required"}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField label={isFa ? "عنوان آدرس" : "Address title"} placeholder={isFa ? "مثلاً خانه" : "e.g. Home"} {...register("title")} />
        <TextField label={isFa ? "نام گیرنده" : "Recipient name"} placeholder={isFa ? "نام و نام خانوادگی" : "Full name"} error={errors.recipientName?.message as string | undefined} {...register("recipientName", { required: isFa ? "نام گیرنده الزامی است." : "Recipient name is required." })} />
        <TextField label={isFa ? "شماره موبایل" : "Mobile number"} placeholder="0912…" dir="ltr" error={errors.phoneNumber?.message as string | undefined} {...register("phoneNumber", { required: isFa ? "شماره موبایل الزامی است." : "Mobile number is required.", pattern: { value: /^(09|۰۹)[0-9۰-۹]{9}$/, message: isFa ? "شماره موبایل معتبر نیست." : "Enter a valid Iranian mobile number." } })} />
        <TextField label={isFa ? "ایمیل" : "Email"} type="email" placeholder="name@example.com" dir="ltr" error={errors.email?.message as string | undefined} {...register("email", { required: isFa ? "ایمیل الزامی است." : "Email is required.", pattern: { value: /^\S+@\S+\.\S+$/, message: isFa ? "ایمیل معتبر نیست." : "Enter a valid email." } })} />
        <SelectField label={isFa ? "استان" : "Province"} error={errors.province?.message as string | undefined} {...register("province", { required: isFa ? "استان را انتخاب کنید." : "Province is required." })}>
          <option value="">{isFa ? "انتخاب استان" : "Select province"}</option>
          <option value={isFa ? "تهران" : "Tehran"}>{isFa ? "تهران" : "Tehran"}</option>
          <option value={isFa ? "البرز" : "Alborz"}>{isFa ? "البرز" : "Alborz"}</option>
          <option value={isFa ? "اصفهان" : "Isfahan"}>{isFa ? "اصفهان" : "Isfahan"}</option>
        </SelectField>
        <TextField label={isFa ? "شهر" : "City"} placeholder={isFa ? "شهر" : "City"} error={errors.city?.message as string | undefined} {...register("city", { required: isFa ? "شهر الزامی است." : "City is required." })} />
        <TextField label={isFa ? "کد پستی" : "Postal code"} placeholder="۱۰ رقم" dir="ltr" error={errors.postalCode?.message as string | undefined} {...register("postalCode", { required: isFa ? "کد پستی الزامی است." : "Postal code is required.", pattern: { value: /^[0-9۰-۹]{10}$/, message: isFa ? "کد پستی باید ۱۰ رقم باشد." : "Postal code must contain 10 digits." } })} />
        <TextField label={isFa ? "پلاک" : "Plaque"} placeholder="—" {...register("plaque")} />
        <TextField label={isFa ? "واحد" : "Unit"} placeholder="—" {...register("unit")} />
        <div className="md:col-span-2"><TextField label={isFa ? "نشانی کامل" : "Street address"} placeholder={isFa ? "خیابان، کوچه، ساختمان" : "Street, alley, building"} error={errors.streetAddress?.message as string | undefined} {...register("streetAddress", { required: isFa ? "نشانی الزامی است." : "Street address is required." })} /></div>
        <label className="flex min-h-11 items-center gap-3 text-xs font-semibold text-ink md:col-span-2"><input type="checkbox" className="h-5 w-5 accent-[var(--color-jade)]" {...register("isDefault")} />{isFa ? "این آدرس به‌عنوان پیش‌فرض ذخیره شود" : "Save as my default address"}</label>
        <div className="md:col-span-2"><TextareaField label={isFa ? "توضیحات سفارش" : "Order notes"} placeholder={isFa ? "نکته‌ای برای تحویل دارید؟" : "Any delivery notes?"} rows={3} {...register("notes")} /></div>
      </div>
    </div>
  );
}

/** Heading primitive used by address and shipping-method sections. */
export function CheckoutSectionHeading({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jade-tint text-jade">{icon}</span><div><h2 className="text-lg font-extrabold text-ink">{title}</h2><p className="mt-1 text-xs leading-6 text-vd-muted">{body}</p></div></div>;
}

/** Loading placeholder matching the saved-address card geometry. */
export function CheckoutSkeletonCard() {
  return <div className="h-[124px] animate-pulse rounded-[18px] bg-surface-soft" aria-hidden />;
}

function SummaryLine({ label, value, muted = false, accent = false }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-vd-muted">{label}</dt><dd className={`m-0 max-w-[60%] text-end font-bold ${muted ? "text-vd-muted" : accent ? "text-jade" : "text-ink"}`}>{value}</dd></div>;
}
