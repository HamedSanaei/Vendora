import Wrapper from "@layout/wrapper";
import Header from "@layout/header";
import Footer from "@layout/footer";
import { VendoraCartPage } from "@components/vendora/cart/cart-page";

export const metadata = {
  title: "Cart | Vendora",
};

export default function Cart() {
  return (
    <Wrapper>
      <div className="vd-root">
        <Header />
        <VendoraCartPage />
        <Footer />
      </div>
    </Wrapper>
  );
}
