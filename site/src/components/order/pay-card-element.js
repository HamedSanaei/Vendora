import React from "react";

const PaymentCardElement = ({ cart_products, isCheckoutSubmit, locale = "en" }) => {
  const isFa = locale === "fa";

  return (
    <div className="my-2">
      <p className="mb-20">
        {isFa
          ? "در این مرحله سفارش شما ثبت می‌شود و پرداخت آنلاین در قدم بعدی به همین سفارش متصل خواهد شد."
          : "Your order will be created now. Online payment will be connected to this order in the next step."}
      </p>
      <div className="order-button-payment mt-25">
        <button
          type="submit"
          className="tp-btn"
          disabled={cart_products.length === 0 || isCheckoutSubmit}
        >
          {isCheckoutSubmit ? (isFa ? "در حال ثبت..." : "Submitting...") : (isFa ? "ثبت سفارش" : "Place order")}
        </button>
      </div>
    </div>
  );
};

export default PaymentCardElement;
