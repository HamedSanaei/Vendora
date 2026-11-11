"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import Loader from "@components/loader/loader";
import ErrorMessage from "@components/error-message/error";
import { accountToken } from "@/lib/auth/customer-profile";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import { useGetUserOrderByIdQuery } from "@/redux/features/orderApi";
import { CheckoutFlowLayout } from "@/components/vendora/checkout/checkout-shell";
import { PaymentResultPanel } from "@/components/vendora/checkout/payment-result";
import { VendoraButton } from "@/components/vendora/ui/button";
import InvoiceArea from "./invoice-area";

/** Shows the owner the saved order, real payment state and printable summary. */
export default function SingleOrderArea({ orderId }) {
  const contentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef });
  const token = accountToken();
  const locale = getLocaleFromPathname(usePathname());
  const fa = locale === "fa";
  const userId = useSelector(state => state.auth.user?.id ?? state.auth.user?._id);
  const { currentData, isError, isLoading, error } = useGetUserOrderByIdQuery({ orderNumber: orderId, userId }, {
    skip: !token || !userId, refetchOnMountOrArgChange: true,
  });
  let content;
  if (isLoading) {
    content = <div className="flex min-h-[220px] items-center justify-center"><Loader loading /></div>;
  } else if (!token || !userId || error?.status === 401) {
    const returnTo = withLocalePath(`/order/${encodeURIComponent(orderId)}`, locale);
    const login = `${withLocalePath("/login", locale)}?returnTo=${encodeURIComponent(returnTo)}`;
    content = <Link className="font-bold text-jade underline" href={login}>
      {fa ? "برای مشاهدهٔ سفارش وارد شوید" : "Sign in to view your order"}
    </Link>;
  } else if (isError) {
    content = <ErrorMessage message={fa ? "دریافت سفارش انجام نشد." : "Unable to load the order."} />;
  } else if (currentData?.order) {
    content = <>
      <PaymentResultPanel orderNumber={orderId} locale={locale} />
      <InvoiceArea innerRef={contentRef} locale={locale} info={currentData.order} />
      <div className="mt-5 flex flex-wrap gap-3">
        <VendoraButton type="button" variant="outline" onClick={handlePrint}>
          {fa ? "چاپ خلاصهٔ سفارش" : "Print order summary"}
        </VendoraButton>
        <VendoraButton variant="ghost" href={withLocalePath("/account/orders", locale)}>
          {fa ? "سفارش‌های من" : "My orders"}
        </VendoraButton>
      </div>
    </>;
  }
  return <CheckoutFlowLayout locale={locale}>
    <main className="vd-container pt-6 pb-12 md:pt-9">{content}</main>
  </CheckoutFlowLayout>;
}
