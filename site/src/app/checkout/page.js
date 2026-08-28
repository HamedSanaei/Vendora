import CheckoutMainArea from "@components/checkout/checkout-main";
import Wrapper from "@layout/wrapper";

export const metadata = {
  title: "پرداخت و ثبت سفارش | وندورا",
};

const Checkout = () => {
  return (
    <Wrapper>
      <CheckoutMainArea/>
    </Wrapper>
  );
};

export default Checkout;
