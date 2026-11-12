import Wrapper from "@layout/wrapper";
import { VendoraLoginPage } from "@components/vendora/auth/login-page";

export const metadata = {
  title: "ثبت‌نام | وندورا",
};

export default function Register() {
  return (
    <Wrapper>
      <VendoraLoginPage intent="register" />
    </Wrapper>
  );
}
