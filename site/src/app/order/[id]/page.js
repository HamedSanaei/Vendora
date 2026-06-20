import SingleOrderArea from "@components/order-area";
import ProtectedRoute from "@components/auth/protected-route";


export const metadata = {
  title: "Single Order - Harri Shop",
};

const OrderPage = async ({ params }) => {
  const { id } = await params;
  return (
    <ProtectedRoute>
      <SingleOrderArea orderId={id} />
    </ProtectedRoute>
  );
};

export default OrderPage;
