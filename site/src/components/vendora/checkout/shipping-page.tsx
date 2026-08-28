"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import useAuthCheck from "@/hooks/use-auth-check";
import { useCreateAddressMutation, useGetAddressesQuery } from "@/redux/features/auth/authApi";
import { set_shipping } from "@/redux/features/order/orderSlice";
import { formatPrice } from "@/lib/vendora/format";
import { findShippingMethod, getShippingMethodTitle, shippingMethods, type ShippingMethodId } from "@/lib/vendora/shipping";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { notifySuccess } from "@/utils/toast";
import { VendoraButton } from "@/components/vendora/ui/button";
import { AddressOption, CheckoutSectionHeading, CheckoutSkeletonCard, NewAddressPanel, OrderSummary, ShippingMethodCard, type ShippingAddressFormValues, type ShippingAddressView } from "./checkout-components";
import { CheckoutFlowLayout, CheckoutStageHeader, CheckoutStickyAction } from "./checkout-shell";
import { PinIcon, TruckIcon } from "@/components/vendora/icons";
import { getCartTotals, type CartLine } from "@/components/vendora/cart/cart-model";

interface ShippingRootState {
  auth: { user?: { name?: string; email?: string; phone?: string } };
  cart: { cart_products: CartLine[] };
  order: { shipping_info?: Record<string, unknown> };
}

/** Full responsive Shipping step connected to the existing account/address APIs. */
export function ShippingPage() {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const router = useRouter();
  const dispatch = useDispatch();
  const authChecked = useAuthCheck();
  const { user } = useSelector((state: ShippingRootState) => state.auth);
  const { cart_products: cartProducts } = useSelector((state: ShippingRootState) => state.cart);
  const { shipping_info: shippingInfo = {} } = useSelector((state: ShippingRootState) => state.order);
  const { data: addressData, isLoading: addressesLoading, isError: addressesError } = useGetAddressesQuery(undefined, { skip: !authChecked || !user });
  const [createAddress, { isLoading: isCreatingAddress }] = useCreateAddressMutation();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(typeof shippingInfo.shippingAddressId === "string" ? shippingInfo.shippingAddressId : null);
  const [selectedMethodId, setSelectedMethodId] = useState<ShippingMethodId>(() => findShippingMethod(String(shippingInfo.shippingMethodId ?? "post")).id);
  const [addressError, setAddressError] = useState("");
  const [methodError, setMethodError] = useState("");
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<ShippingAddressFormValues>({
    defaultValues: {
      title: "",
      recipientName: user?.name ?? "",
      phoneNumber: user?.phone ?? "",
      province: "",
      city: "",
      streetAddress: "",
      plaque: "",
      unit: "",
      postalCode: "",
      email: user?.email ?? "",
      isDefault: true,
      notes: "",
    },
  });

  const addresses = useMemo<ShippingAddressView[]>(() => {
    if (!Array.isArray(addressData)) return [];
    return addressData as ShippingAddressView[];
  }, [addressData]);
  const selectedMethod = shippingMethods.find((method) => method.id === selectedMethodId) ?? shippingMethods[0];
  const subtotal = getCartTotals(cartProducts).subtotal;
  const isNewAddress = selectedAddressId === "new" || addresses.length === 0;
  const busy = addressesLoading || isCreatingAddress;

  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      const returnTo = withLocalePath("/shipping", locale);
      router.replace(`${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authChecked, locale, router, user]);

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
    setSelectedAddressId(defaultAddress.id);
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!user) return;
    setValue("recipientName", user.name ?? "");
    setValue("phoneNumber", user.phone ?? "");
    setValue("email", user.email ?? "");
  }, [setValue, user]);

  if (!authChecked || !user) {
    return <div className="vd-root flex min-h-screen items-center justify-center bg-white text-sm text-vd-muted">{isFa ? "در حال آماده‌سازی اطلاعات ارسال…" : "Preparing shipping details…"}</div>;
  }

  if (cartProducts.length === 0) {
    return <CheckoutFlowLayout locale={locale}><main className="vd-container flex min-h-[460px] flex-col items-center justify-center text-center"><h1 className="text-2xl font-extrabold text-ink">{isFa ? "سبد خرید شما خالی است" : "Your cart is empty"}</h1><p className="mt-3 text-sm text-vd-muted">{isFa ? "برای انتخاب روش ارسال، ابتدا محصولی به سبد اضافه کنید." : "Add a product to your cart before choosing delivery."}</p><Link href={withLocalePath("/shop", locale)} className="vd-focus mt-6 flex h-12 items-center justify-center rounded-control bg-jade px-6 text-sm font-bold text-white hover:bg-jade-dark">{isFa ? "مشاهده فروشگاه" : "Browse shop"}</Link></main></CheckoutFlowLayout>;
  }

  const handleContinue = async (values: ShippingAddressFormValues) => {
    setAddressError("");
    setMethodError("");
    if (!selectedMethod) {
      setMethodError(isFa ? "لطفاً یک روش ارسال انتخاب کنید." : "Please choose a shipping method.");
      return;
    }

    let addressId = selectedAddressId;
    let selectedAddress = addresses.find((address) => address.id === addressId);
    if (isNewAddress) {
      const result = await createAddress({
        title: values.title || (isFa ? "آدرس جدید" : "New address"),
        recipientName: values.recipientName,
        phoneNumber: normalizeDigits(values.phoneNumber),
        province: values.province,
        city: values.city,
        streetAddress: values.streetAddress,
        plaque: normalizeDigits(values.plaque),
        unit: normalizeDigits(values.unit),
        postalCode: normalizeDigits(values.postalCode),
        isDefault: values.isDefault,
      }) as { error?: { data?: { message?: string } }; data?: unknown };
      if (result?.error) {
        setAddressError(result.error?.data?.message ?? (isFa ? "ثبت آدرس انجام نشد." : "The address could not be saved."));
        return;
      }
      const returnedAddresses = Array.isArray(result?.data) ? result.data as ShippingAddressView[] : [];
      const created = returnedAddresses.find((address) => address.postalCode === normalizeDigits(values.postalCode)) ?? returnedAddresses.find((address) => address.isDefault) ?? returnedAddresses[0];
      addressId = created?.id ?? null;
      selectedAddress = created;
      if (!addressId) {
        setAddressError(isFa ? "آدرس ذخیره شد، اما شناسهٔ آن دریافت نشد. دوباره تلاش کنید." : "The address was saved without an identifier. Please try again.");
        return;
      }
      setSelectedAddressId(addressId);
    }

    if (!addressId) {
      setAddressError(isFa ? "لطفاً یک آدرس انتخاب کنید." : "Please select a shipping address.");
      return;
    }

    dispatch(set_shipping({
      ...shippingInfo,
      shippingAddressId: addressId,
      shippingAddress: selectedAddress,
      shippingMethodId: selectedMethod.id,
      shippingMethodTitle: getShippingMethodTitle(selectedMethod, locale),
      shippingPaymentMode: selectedMethod.paymentMode,
      shippingCost: selectedMethod.paymentMode === "prepaid" ? selectedMethod.cost : 0,
      freightCollect: selectedMethod.paymentMode === "collect",
      email: values.email,
      notes: values.notes,
    }));
    notifySuccess(isFa ? "اطلاعات ارسال ذخیره شد." : "Shipping details saved.");
    router.push(withLocalePath("/checkout", locale));
  };

  return (
    <CheckoutFlowLayout locale={locale}>
      <main className="vd-container pb-32 pt-6 md:pt-9 lg:pb-16">
        <CheckoutStageHeader locale={locale} activeStep="shipping" eyebrow={isFa ? "مرحله دوم خرید" : "Checkout step 2"} title={isFa ? "اطلاعات ارسال" : "Shipping details"} description={isFa ? "آدرس و روش ارسال سفارش خود را انتخاب کنید." : "Choose an address and a delivery method for your order."} backHref={withLocalePath("/cart", locale)} backLabel={isFa ? "بازگشت به سبد" : "Back to cart"} />

        <form onSubmit={handleSubmit(handleContinue)} className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="min-w-0 space-y-7">
            <section className="rounded-[20px] border border-vd-line bg-white p-4 md:p-6">
              <CheckoutSectionHeading icon={<PinIcon />} title={isFa ? "آدرس تحویل" : "Delivery address"} body={isFa ? "آدرس موردنظر را برای دریافت سفارش انتخاب کنید." : "Choose where you want your order delivered."} />
              {addressesLoading ? <div className="mt-5 grid gap-3 md:grid-cols-2"><CheckoutSkeletonCard /><CheckoutSkeletonCard /></div> : null}
              {addressesError ? <p role="alert" className="mt-5 rounded-control bg-vd-danger-tint p-3 text-sm text-vd-danger">{isFa ? "دریافت آدرس‌ها با خطا روبه‌رو شد." : "Saved addresses could not be loaded."}</p> : null}
              {!addressesLoading && addresses.length > 0 ? <div className="mt-5 grid gap-3 md:grid-cols-2">{addresses.map((address) => <AddressOption key={address.id} address={address} locale={locale} selected={selectedAddressId === address.id} onSelect={() => { setSelectedAddressId(address.id); setAddressError(""); }} />)}<label className={`vd-focus flex min-h-[124px] cursor-pointer items-center justify-center rounded-[18px] border border-dashed p-4 text-sm font-bold ${selectedAddressId === "new" ? "border-jade bg-jade-tint text-jade" : "border-vd-line text-vd-muted hover:border-jade hover:text-jade"}`}><input type="radio" name="shipping-address" checked={selectedAddressId === "new"} onChange={() => { setSelectedAddressId("new"); setAddressError(""); }} className="sr-only" />+ {isFa ? "افزودن آدرس جدید" : "Add a new address"}</label></div> : null}
              {addressError ? <p role="alert" className="mt-4 rounded-control bg-vd-danger-tint p-3 text-xs font-semibold text-vd-danger">{addressError}</p> : null}
              {isNewAddress ? <NewAddressPanel locale={locale} register={register} errors={errors} /> : null}
            </section>

            <section className="rounded-[20px] border border-vd-line bg-white p-4 md:p-6">
              <CheckoutSectionHeading icon={<TruckIcon />} title={isFa ? "روش ارسال" : "Shipping method"} body={isFa ? "پست و تیپاکس پیش‌پرداخت هستند؛ کرایه باربری هنگام تحویل دریافت می‌شود." : "Post and Tipax are prepaid; freight is collected on delivery."} />
              <div className="mt-5 grid gap-3">{shippingMethods.map((method) => <ShippingMethodCard key={method.id} method={method} locale={locale} selected={selectedMethodId === method.id} onSelect={() => { setSelectedMethodId(method.id); setMethodError(""); }} />)}</div>
              {methodError ? <p role="alert" className="mt-4 rounded-control bg-vd-danger-tint p-3 text-xs font-semibold text-vd-danger">{methodError}</p> : null}
            </section>
          </div>

          <div className="min-w-0">
            <div className="hidden lg:block"><OrderSummary locale={locale} subtotal={subtotal} shippingMethod={selectedMethod} action={<VendoraButton type="submit" size="lg" className="w-full" disabled={busy}>{busy ? (isFa ? "در حال ذخیره…" : "Saving…") : (isFa ? "ادامه به پرداخت" : "Continue to payment")}</VendoraButton>} /></div>
            <div className="lg:hidden"><OrderSummary locale={locale} subtotal={subtotal} shippingMethod={selectedMethod} /></div>
          </div>

          <CheckoutStickyAction label={isFa ? "مبلغ قابل پرداخت" : "Payable now"} value={formatPrice(subtotal + (selectedMethod.paymentMode === "prepaid" ? selectedMethod.cost : 0), locale)} action={<VendoraButton type="submit" size="lg" disabled={busy} className="min-w-[164px]">{busy ? (isFa ? "در حال ذخیره…" : "Saving…") : (isFa ? "ادامه به پرداخت" : "Continue")}</VendoraButton>} />
        </form>
      </main>
    </CheckoutFlowLayout>
  );
}

function normalizeDigits(value = "") {
  return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
