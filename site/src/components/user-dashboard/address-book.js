'use client';
import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation,
  useUpdateAddressMutation,
} from "src/redux/features/auth/authApi";
import { notifyError, notifySuccess } from "@utils/toast";
import { getLocaleFromPathname } from "@lib/locale-path";

const emptyAddress = {
  title: "",
  recipientName: "",
  phoneNumber: "",
  province: "",
  city: "",
  streetAddress: "",
  plaque: "",
  unit: "",
  postalCode: "",
  isDefault: false,
};

const faText = {
  title: "آدرس‌های من",
  subtitle: "برای ارسال سفارش‌ها می‌توانید چند آدرس در ایران تعریف کنید و یکی را پیش‌فرض بگذارید.",
  add: "افزودن آدرس",
  edit: "ویرایش آدرس",
  save: "ذخیره آدرس",
  cancel: "انصراف",
  empty: "هنوز آدرسی ثبت نکرده‌اید.",
  default: "پیش‌فرض",
  makeDefault: "انتخاب به عنوان پیش‌فرض",
  remove: "حذف",
  required: "لطفاً نام گیرنده، موبایل، استان، شهر، آدرس و کد پستی را کامل کنید.",
  postal: "کد پستی باید ۱۰ رقم باشد.",
  phone: "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.",
  saved: "آدرس با موفقیت ذخیره شد.",
  deleted: "آدرس حذف شد.",
  defaultSaved: "آدرس پیش‌فرض تغییر کرد.",
  failed: "عملیات آدرس انجام نشد.",
  fields: {
    title: "عنوان آدرس",
    recipientName: "نام گیرنده",
    phoneNumber: "شماره موبایل",
    province: "استان",
    city: "شهر",
    streetAddress: "نشانی کامل",
    plaque: "پلاک",
    unit: "واحد",
    postalCode: "کد پستی",
    isDefault: "این آدرس پیش‌فرض باشد",
  },
};

const enText = {
  title: "My Addresses",
  subtitle: "Create one or more Iranian shipping addresses and choose a default address.",
  add: "Add address",
  edit: "Edit address",
  save: "Save address",
  cancel: "Cancel",
  empty: "You have not added any addresses yet.",
  default: "Default",
  makeDefault: "Make default",
  remove: "Delete",
  required: "Please complete recipient, phone, province, city, address, and postal code.",
  postal: "Postal code must be 10 digits.",
  phone: "Phone number must start with 09 and contain 11 digits.",
  saved: "Address was saved.",
  deleted: "Address was deleted.",
  defaultSaved: "Default address was updated.",
  failed: "Address action failed.",
  fields: {
    title: "Address title",
    recipientName: "Recipient name",
    phoneNumber: "Mobile number",
    province: "Province",
    city: "City",
    streetAddress: "Full address",
    plaque: "Plaque",
    unit: "Unit",
    postalCode: "Postal code",
    isDefault: "Use as default address",
  },
};

const AddressBook = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const t = isFa ? faText : enText;
  const { data: addresses = [], isLoading, refetch } = useGetAddressesQuery();
  const [createAddress] = useCreateAddressMutation();
  const [updateAddress] = useUpdateAddressMutation();
  const [deleteAddress] = useDeleteAddressMutation();
  const [setDefaultAddress] = useSetDefaultAddressMutation();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAddress);

  const sortedAddresses = useMemo(
    () => [...addresses].sort((first, second) => Number(second.isDefault) - Number(first.isDefault)),
    [addresses]
  );

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const current = addresses.find((address) => address.id === editingId);
    if (current) {
      setForm({
        title: current.title ?? "",
        recipientName: current.recipientName ?? "",
        phoneNumber: current.phoneNumber ?? "",
        province: current.province ?? "",
        city: current.city ?? "",
        streetAddress: current.streetAddress ?? "",
        plaque: current.plaque ?? "",
        unit: current.unit ?? "",
        postalCode: current.postalCode ?? "",
        isDefault: Boolean(current.isDefault),
      });
    }
  }, [addresses, editingId]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyAddress);
  };

  const validate = () => {
    const phone = normalizeDigits(form.phoneNumber);
    const postalCode = normalizeDigits(form.postalCode);

    if (!form.recipientName.trim() || !phone.trim() || !form.province.trim() || !form.city.trim() || !form.streetAddress.trim() || !postalCode.trim()) {
      return t.required;
    }

    if (!/^09\d{9}$/.test(phone)) {
      return t.phone;
    }

    if (!/^\d{10}$/.test(postalCode)) {
      return t.postal;
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      notifyError(validationError);
      return;
    }

    const payload = {
      ...form,
      phoneNumber: normalizeDigits(form.phoneNumber),
      postalCode: normalizeDigits(form.postalCode),
      plaque: normalizeDigits(form.plaque),
      unit: normalizeDigits(form.unit),
    };

    const result = editingId ? await updateAddress({ id: editingId, ...payload }) : await createAddress(payload);
    if (result?.error) {
      notifyError(result.error?.data?.message ?? t.failed);
      return;
    }

    notifySuccess(t.saved);
    resetForm();
    refetch();
  };

  const handleDelete = async (id) => {
    const result = await deleteAddress(id);
    if (result?.error) {
      notifyError(result.error?.data?.message ?? t.failed);
      return;
    }

    notifySuccess(t.deleted);
    refetch();
  };

  const handleDefault = async (id) => {
    const result = await setDefaultAddress(id);
    if (result?.error) {
      notifyError(result.error?.data?.message ?? t.failed);
      return;
    }

    notifySuccess(t.defaultSaved);
    refetch();
  };

  return (
    <div className="profile__address-book">
      <div className="profile__address-header">
        <div>
          <h3 className="profile__info-title">{t.title}</h3>
          <p>{t.subtitle}</p>
        </div>
        <button type="button" className="tp-btn-border" onClick={resetForm}>
          {t.add}
        </button>
      </div>

      <div className="profile__address-grid">
        <div className="profile__address-list">
          {isLoading && <p>{isFa ? "در حال دریافت آدرس‌ها..." : "Loading addresses..."}</p>}
          {!isLoading && sortedAddresses.length === 0 && <p>{t.empty}</p>}
          {sortedAddresses.map((address) => (
            <article key={address.id} className={`profile__address-card ${address.isDefault ? "is-default" : ""}`}>
              <div className="profile__address-card-head">
                <h4>{address.title || address.recipientName}</h4>
                {address.isDefault && <span>{t.default}</span>}
              </div>
              <p>{address.recipientName} - {address.phoneNumber}</p>
              <p>{address.province}، {address.city}</p>
              <p>{address.streetAddress}</p>
              <p>{isFa ? "کد پستی:" : "Postal code:"} {address.postalCode}</p>
              <div className="profile__address-actions">
                <button type="button" onClick={() => setEditingId(address.id)}>
                  {t.edit}
                </button>
                {!address.isDefault && (
                  <button type="button" onClick={() => handleDefault(address.id)}>
                    {t.makeDefault}
                  </button>
                )}
                <button type="button" className="danger" onClick={() => handleDelete(address.id)}>
                  {t.remove}
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="profile__address-form" onSubmit={handleSubmit}>
          <h4>{editingId ? t.edit : t.add}</h4>
          <AddressInput label={t.fields.title} value={form.title} onChange={(value) => updateField("title", value)} />
          <AddressInput label={t.fields.recipientName} value={form.recipientName} onChange={(value) => updateField("recipientName", value)} />
          <AddressInput label={t.fields.phoneNumber} value={form.phoneNumber} onChange={(value) => updateField("phoneNumber", value)} inputMode="numeric" />
          <div className="profile__address-form-row">
            <AddressInput label={t.fields.province} value={form.province} onChange={(value) => updateField("province", value)} />
            <AddressInput label={t.fields.city} value={form.city} onChange={(value) => updateField("city", value)} />
          </div>
          <AddressInput label={t.fields.streetAddress} value={form.streetAddress} onChange={(value) => updateField("streetAddress", value)} />
          <div className="profile__address-form-row">
            <AddressInput label={t.fields.plaque} value={form.plaque} onChange={(value) => updateField("plaque", value)} inputMode="numeric" />
            <AddressInput label={t.fields.unit} value={form.unit} onChange={(value) => updateField("unit", value)} inputMode="numeric" />
            <AddressInput label={t.fields.postalCode} value={form.postalCode} onChange={(value) => updateField("postalCode", value)} inputMode="numeric" />
          </div>
          <label className="profile__address-checkbox">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => updateField("isDefault", event.target.checked)} />
            <span>{t.fields.isDefault}</span>
          </label>
          <div className="profile__address-submit">
            <button type="button" className="tp-btn-border" onClick={resetForm}>
              {t.cancel}
            </button>
            <button type="submit" className="tp-btn">
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddressInput = ({ label, value, onChange, inputMode }) => (
  <label className="profile__address-input">
    <span>{label}</span>
    <input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} />
  </label>
);

function normalizeDigits(value = "") {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export default AddressBook;
