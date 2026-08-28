import Wrapper from "@layout/wrapper";
import { VendoraLoginPage } from "@components/vendora/auth/login-page";

export const metadata = {
  title: "Login | Vendora",
};

export default function Login() {
  return (
    <Wrapper>
      <VendoraLoginPage />
    </Wrapper>
  );
}
