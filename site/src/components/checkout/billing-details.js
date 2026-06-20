import ErrorMessage from "@components/error-message/error";
import React from "react";
import { useSelector } from "react-redux";

const BillingDetails = ({
  register,
  errors,
  addresses = [],
  selectedAddressId,
  setSelectedAddressId,
  locale = "en",
}) => {
  const { user } = useSelector((state) => state.auth);
  const isFa = locale === "fa";
  const t = {
    title: isFa ? "آدرس ارسال" : "Shipping Address",
    choose: isFa ? "انتخاب آدرس ذخیره‌شده" : "Choose a saved address",
    newAddress: isFa ? "افزودن آدرس جدید" : "Add a new address",
    noAddress: isFa ? "هنوز آدرس ذخیره‌شده‌ای ندارید. یک آدرس جدید وارد کنید." : "You have no saved addresses yet. Add a new address.",
    firstName: isFa ? "نام" : "First Name",
    lastName: isFa ? "نام خانوادگی" : "Last Name",
    recipientName: isFa ? "نام گیرنده" : "Recipient Name",
    addressTitle: isFa ? "عنوان آدرس" : "Address Title",
    address: isFa ? "نشانی کامل" : "Street Address",
    city: isFa ? "شهر" : "Town / City",
    province: isFa ? "استان" : "Province",
    zipCode: isFa ? "کد پستی" : "Postcode",
    plaque: isFa ? "پلاک" : "Plaque",
    unit: isFa ? "واحد" : "Unit",
    email: isFa ? "ایمیل" : "Email Address",
    phone: isFa ? "شماره موبایل" : "Phone",
    notes: isFa ? "توضیحات سفارش" : "Order Notes",
    notesPlaceholder: isFa ? "اگر نکته‌ای برای ارسال سفارش دارید بنویسید." : "Notes about your order, e.g. special notes for delivery.",
    defaultAddress: isFa ? "این آدرس در حساب من ذخیره و پیش‌فرض شود" : "Save this address as my default address",
  };

  const shouldShowNewAddress = selectedAddressId === "new" || addresses.length === 0;

  return (
    <>
      <div className="checkout-address-selector mb-30">
        <h4>{t.title}</h4>
        {addresses.length > 0 ? (
          <div className="checkout-address-list">
            {addresses.map((address) => (
              <label key={address.id} className={`checkout-address-option ${selectedAddressId === address.id ? "active" : ""}`}>
                <input
                  type="radio"
                  name="selectedAddress"
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                />
                <span>
                  <strong>{address.title || address.recipientName}</strong>
                  <small>{address.province}، {address.city}، {address.streetAddress}</small>
                  <small>{address.phoneNumber} - {address.postalCode}</small>
                </span>
              </label>
            ))}
            <label className={`checkout-address-option ${selectedAddressId === "new" ? "active" : ""}`}>
              <input
                type="radio"
                name="selectedAddress"
                checked={selectedAddressId === "new"}
                onChange={() => setSelectedAddressId("new")}
              />
              <span>
                <strong>{t.newAddress}</strong>
              </span>
            </label>
          </div>
        ) : (
          <p>{t.noAddress}</p>
        )}
      </div>

      {shouldShowNewAddress && (
        <div className="row">
          <CheckoutFormList name="addressTitle" col="12" label={t.addressTitle} placeholder={t.addressTitle} register={register} error={errors?.addressTitle?.message} />
          <CheckoutFormList name="recipientName" col="12" label={t.recipientName} placeholder={t.recipientName} register={register} error={errors?.recipientName?.message} defaultValue={user?.name} />
          <CheckoutFormList name="address" col="12" label={t.address} placeholder={t.address} register={register} error={errors?.address?.message} />
          <CheckoutFormList name="city" col="6" label={t.city} placeholder={t.city} register={register} error={errors?.city?.message} />
          <CheckoutFormList name="province" col="6" label={t.province} placeholder={t.province} register={register} error={errors?.province?.message} />
          <CheckoutFormList name="plaque" col="4" label={t.plaque} placeholder={t.plaque} register={register} error={errors?.plaque?.message} />
          <CheckoutFormList name="unit" col="4" label={t.unit} placeholder={t.unit} register={register} error={errors?.unit?.message} />
          <CheckoutFormList name="zipCode" col="4" label={t.zipCode} placeholder={t.zipCode} register={register} error={errors?.zipCode?.message} />
          <CheckoutFormList name="contact" col="6" label={t.phone} placeholder={t.phone} register={register} error={errors?.contact?.message} defaultValue={user?.phone} />
          <CheckoutFormList name="email" col="6" type="email" label={t.email} placeholder={t.email} register={register} error={errors?.email?.message} defaultValue={user?.email} />
          <div className="col-12">
            <label className="checkout-save-address">
              <input type="checkbox" {...register("isDefaultAddress")} />
              <span>{t.defaultAddress}</span>
            </label>
          </div>
        </div>
      )}

      <div className="order-notes">
        <div className="checkout-form-list">
          <label>{t.notes}</label>
          <textarea
            id="checkout-mess"
            cols="30"
            rows="10"
            placeholder={t.notesPlaceholder}
            {...register("notes")}
          ></textarea>
        </div>
      </div>
    </>
  );
};

function CheckoutFormList({
  col,
  label,
  type = "text",
  placeholder,
  isRequired = true,
  name,
  register,
  error,
  defaultValue,
}) {
  return (
    <div className={`col-md-${col}`}>
      <div className="checkout-form-list">
        {label && (
          <label>
            {label} {isRequired && <span className="required">*</span>}
          </label>
        )}
        <input
          {...register(`${name}`)}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue ? defaultValue : ""}
        />
        {error && <ErrorMessage message={error} />}
      </div>
    </div>
  );
}

export default BillingDetails;
