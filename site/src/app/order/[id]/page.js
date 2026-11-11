import SingleOrderArea from "@components/order-area";
import Wrapper from "@layout/wrapper";


export const metadata = {
  title: "Vendora",
};

const OrderPage = async ({ params }) => {
  const { id } = await params;
  return <Wrapper><SingleOrderArea key={id} orderId={id} /></Wrapper>;
};

export default OrderPage;
