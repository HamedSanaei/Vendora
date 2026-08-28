import React from "react";
// internal
import useCartInfo from "@hooks/use-cart-info";
import ErrorMessage from "@components/error-message/error";

const OrderDetails = ({
  register,
  errors,
  handleShippingCost,
  cartTotal,
  shippingCost,
  discountAmount,
  locale = "en",
  shippingCompleted = false,
  shippingInfo = {},
}) => {
  const { total } = useCartInfo();
  const isFa = locale === "fa";
  const formatPrice = (value) =>
    new Intl.NumberFormat(isFa ? "fa-IR" : "en-US").format(Number(value || 0)) + (isFa ? " تومان" : " Toman");

  return (
    <React.Fragment>
      <tr className="cart-subtotal">
        <th>{isFa ? "جمع سبد خرید" : "Cart Subtotal"}</th>
        <td className="text-end">
          <span className="amount text-end">{formatPrice(total)}</span>
        </td>
      </tr>
      <tr className="shipping">
        <th>{isFa ? "ارسال" : "Shipping"}</th>
        <td className="text-end">
          <ul>
            {shippingCompleted ? (
              <li>
                <span className="amount font-weight-bold">{shippingInfo.shippingMethodTitle ?? (isFa ? "روش ارسال انتخاب‌شده" : "Selected shipping method")}</span>
                <small className="d-block mt-1 text-muted">{shippingInfo.shippingPaymentMode === "collect" ? (isFa ? "پرداخت کرایه هنگام تحویل" : "Shipping collected on delivery") : formatPrice(shippingCost)}</small>
              </li>
            ) : (
              <>
                <li>
                  <input {...register("shippingOption", { required: "Shipping Option is required!" })} id="flat_shipping" type="radio" name="shippingOption" />
                  <label onClick={() => handleShippingCost(60000)} htmlFor="flat_shipping"><span className="amount">{isFa ? "پست پیشتاز: " : "Express post: "}{formatPrice(60000)}</span></label>
                  <ErrorMessage message={errors?.shippingOption?.message} />
                </li>
                <li>
                  <input {...register("shippingOption", { required: "Shipping Option is required!" })} id="free_shipping" type="radio" name="shippingOption" />
                  <label onClick={() => handleShippingCost(20000)} htmlFor="free_shipping">{isFa ? "تیپاکس: " : "Tipax: "}{formatPrice(20000)}</label>
                  <ErrorMessage message={errors?.shippingOption?.message} />
                </li>
                <li>
                  <input {...register("shippingOption", { required: "Shipping Option is required!" })} id="freight_shipping" type="radio" name="shippingOption" />
                  <label onClick={() => handleShippingCost(0)} htmlFor="freight_shipping">{isFa ? "باربری همراه بیمه: پرداخت هنگام تحویل" : "Insured freight: pay on delivery"}</label>
                  <ErrorMessage message={errors?.shippingOption?.message} />
                </li>
              </>
            )}
          </ul>
        </td>
      </tr>

      <tr className="shipping">
        <th>{isFa ? "زیرمجموع" : "Sub Total"}</th>
        <td className="text-end">
          <strong>
            <span className="amount">{formatPrice(total)}</span>
          </strong>
        </td>
      </tr>

      <tr className="shipping">
        <th>{isFa ? "هزینه ارسال" : "Shipping Cost"}</th>
        <td className="text-end">
          <strong>
            <span className="amount">{formatPrice(shippingCost)}</span>
          </strong>
        </td>
      </tr>

      <tr className="shipping">
        <th>{isFa ? "تخفیف" : "Discount"}</th>
        <td className="text-end">
          <strong>
            <span className="amount">{formatPrice(discountAmount)}</span>
          </strong>
        </td>
      </tr>

      <tr className="order-total">
        <th>{isFa ? "مبلغ نهایی" : "Total Order"}</th>
        <td className="text-end">
          <strong>
            <span className="amount">{formatPrice(cartTotal)}</span>
          </strong>
        </td>
      </tr>
    </React.Fragment>
  );
};

export default OrderDetails;
