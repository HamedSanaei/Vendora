'use client';
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { usePathname, useRouter } from "next/navigation";
import { notifyError, notifySuccess } from "@utils/toast";
import { useGetOfferCouponsQuery } from "src/redux/features/coupon/couponApi";
import Loader from "@components/loader/loader";
import { set_coupon } from "src/redux/features/coupon/couponSlice";
import useCartInfo from "./use-cart-info";
import { set_shipping } from "src/redux/features/order/orderSlice";
import { useAddOrderMutation } from "src/redux/features/order/orderApi";
import { useGetAddressesQuery } from "src/redux/features/auth/authApi";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const useCheckoutSubmit = () => {
  const { data: offerCoupons, isError, isLoading } = useGetOfferCouponsQuery();
  const [addOrder] = useAddOrderMutation();
  const { data: addresses = [], refetch: refetchAddresses, isLoading: isAddressesLoading } = useGetAddressesQuery();
  const { cart_products } = useSelector((state) => state.cart);
  const { user } = useSelector((state) => state.auth);
  const { shipping_info } = useSelector((state) => state.order);
  const { total, setTotal } = useCartInfo();
  const [cartTotal, setCartTotal] = useState(0);
  const [minimumAmount, setMinimumAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountProductType, setDiscountProductType] = useState("");
  const [isCheckoutSubmit, setIsCheckoutSubmit] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const couponRef = useRef("");

  useEffect(() => {
    const storedCoupon = localStorage.getItem("couponInfo");
    if (!storedCoupon) {
      return;
    }

    const coupon = JSON.parse(storedCoupon);
    setDiscountPercentage(coupon.discountPercentage);
    setMinimumAmount(coupon.minimumAmount);
    setDiscountProductType(coupon.productType);
  }, []);

  useEffect(() => {
    if (minimumAmount - discountAmount > total || cart_products.length === 0) {
      setDiscountPercentage(0);
      localStorage.removeItem("couponInfo");
    }
  }, [minimumAmount, total, discountAmount, cart_products]);

  useEffect(() => {
    if (selectedAddressId) {
      return;
    }

    if (addresses.length > 0) {
      const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
      setSelectedAddressId(defaultAddress.id);
      return;
    }

    if (!isAddressesLoading) {
      setSelectedAddressId("new");
    }
  }, [addresses, isAddressesLoading, selectedAddressId]);

  useEffect(() => {
    const discountedProducts = cart_products?.filter((product) => product.type === discountProductType);
    const discountProductTotal = discountedProducts?.reduce(
      (sum, product) => sum + product.originalPrice * product.orderQuantity,
      0
    );
    const subtotal = Number(total + shippingCost);
    const discountTotal = Number(discountProductTotal * (discountPercentage / 100));
    setDiscountAmount(discountTotal);
    setCartTotal(Math.max(0, subtotal - discountTotal));
  }, [total, shippingCost, discountPercentage, cart_products, discountProductType]);

  useEffect(() => {
    setValue("address", shipping_info.address);
    setValue("city", shipping_info.city);
    setValue("province", shipping_info.province);
    setValue("zipCode", shipping_info.zipCode);
    setValue("email", shipping_info.email ?? user?.email);
    setValue("contact", shipping_info.contact ?? user?.phone);
  }, [user, setValue, shipping_info]);

  const handleCouponCode = (event) => {
    event.preventDefault();

    if (!couponRef.current?.value) {
      notifyError(isFa ? "لطفاً کد تخفیف را وارد کنید." : "Please input a coupon code!");
      return;
    }
    if (isLoading) {
      return <Loader loading={isLoading} />;
    }
    if (isError) {
      notifyError(isFa ? "خطایی رخ داد." : "Something went wrong");
      return;
    }

    const result = offerCoupons?.filter(
      (coupon) => coupon.couponCode === couponRef.current?.value
    );

    if (result.length < 1) {
      notifyError(isFa ? "کد تخفیف معتبر نیست." : "Please input a valid coupon!");
      return;
    }

    if (dayjs().isAfter(dayjs(result[0]?.endTime))) {
      notifyError(isFa ? "این کد تخفیف منقضی شده است." : "This coupon is not valid!");
      return;
    }

    if (total < result[0]?.minimumAmount) {
      notifyError(isFa ? "مبلغ سفارش برای این کد تخفیف کافی نیست." : `Minimum ${result[0].minimumAmount} Toman required.`);
      return;
    }

    notifySuccess(isFa ? "کد تخفیف اعمال شد." : `Your coupon ${result[0].title} was applied.`);
    setMinimumAmount(result[0]?.minimumAmount);
    setDiscountProductType(result[0].productType);
    setDiscountPercentage(result[0].discountPercentage);
    dispatch(set_coupon(result[0]));
  };

  const handleShippingCost = (value) => {
    setShippingCost(value);
  };

  const submitHandler = async (data) => {
    dispatch(set_shipping(data));
    setIsCheckoutSubmit(true);

    if (!user?._id) {
      notifyError(isFa ? "برای ادامه خرید باید وارد حساب کاربری شوید." : "Please login before checkout.");
      setIsCheckoutSubmit(false);
      return;
    }

    if (!selectedAddressId) {
      notifyError(isFa ? "لطفاً یک آدرس انتخاب کنید یا آدرس جدید وارد کنید." : "Please select or enter a shipping address.");
      setIsCheckoutSubmit(false);
      return;
    }

    const newAddress = selectedAddressId === "new"
      ? {
          title: data.addressTitle || (isFa ? "آدرس جدید" : "New address"),
          recipientName: data.recipientName || user?.name,
          phoneNumber: normalizeDigits(data.contact),
          province: data.province,
          city: data.city,
          streetAddress: data.address,
          plaque: normalizeDigits(data.plaque),
          unit: normalizeDigits(data.unit),
          postalCode: normalizeDigits(data.zipCode),
          saveToAddressBook: true,
          isDefault: Boolean(data.isDefaultAddress),
        }
      : null;

    const orderData = {
      shippingCost,
      discountAmount,
      shippingAddressId: selectedAddressId === "new" ? null : selectedAddressId,
      newAddress,
      items: cart_products.map((item) => ({
        productId: item.id ?? item._id,
        quantity: item.orderQuantity ?? item.quantity ?? 1,
      })),
    };

    const result = await addOrder(orderData);
    if (result?.error) {
      notifyError(result.error?.data?.message ?? (isFa ? "ثبت سفارش انجام نشد." : "Order could not be created."));
      setIsCheckoutSubmit(false);
      return;
    }

    refetchAddresses();
    notifySuccess(isFa ? "سفارش شما ثبت شد و در انتظار پرداخت است." : "Your order was created and is pending payment.");
    router.push(withLocalePath(`/order/${result.data?.orderNumber}`, locale));
    setIsCheckoutSubmit(false);
  };

  return {
    handleCouponCode,
    couponRef,
    handleShippingCost,
    discountAmount,
    total,
    shippingCost,
    discountPercentage,
    discountProductType,
    isCheckoutSubmit,
    setTotal,
    register,
    errors,
    cardError: "",
    submitHandler,
    stripe: null,
    handleSubmit,
    clientSecret: "",
    setClientSecret: () => {},
    cartTotal,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    locale,
  };
};

function normalizeDigits(value = "") {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export default useCheckoutSubmit;
