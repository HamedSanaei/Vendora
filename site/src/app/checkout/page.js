import CheckoutMainArea from "@components/checkout/checkout-main";
import ProtectedRoute from "@components/auth/protected-route";

export const metadata = {
  title: "Checkout - Harri Shop",
};

const Checkout = () => {
  return (
    <ProtectedRoute>
      <CheckoutMainArea/>
    </ProtectedRoute>
  );
};

export default Checkout;
