import { ShippingPage } from "@components/vendora/checkout/shipping-page";
import Wrapper from "@layout/wrapper";

export const metadata = {
  title: "Shipping | Vendora",
};

/** Shipping step for both locale-prefixed storefront routes. */
export default function Shipping() {
  return <Wrapper><ShippingPage /></Wrapper>;
}
