import Wrapper from "@layout/wrapper";
import { StoreHeader } from "@/components/vendora/layout/store-chrome";
import Footer from "@layout/footer";
import { SmsPasswordRecovery } from "@/components/vendora/auth/sms-password-recovery";
export const metadata = { title: "بازیابی رمز | Vendora", robots: { index: false, follow: false } };
/** Uses the existing localized recovery route and store shell; no reset token is displayed. */
export default function Forgot() { return <Wrapper><StoreHeader /><SmsPasswordRecovery /><Footer /></Wrapper>; }
