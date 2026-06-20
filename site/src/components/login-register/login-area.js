'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
// internal
import Shapes from "./shapes";
import LoginForm from "@components/forms/login-form";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const LoginArea = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  return (
    <section className="login__area pt-110 pb-110">
      <div className="container">
        <div className="login__inner p-relative z-index-1">
          <Shapes />
          <div className="row justify-content-center">
            <div className="col-xl-6 col-lg-8 col-md-10">
              <div className="login__wrapper">
                <div className="login__top mb-30 text-center">
                  <h3 className="login__title">{isFa ? "خوش برگشتی" : "Hello Again"}</h3>
                  <p>
                    {isFa
                      ? "برای ورود به حساب کاربری، ایمیل و رمز عبور خود را وارد کنید."
                      : "Enter your credentials to access your account."}
                  </p>
                </div>
                <div className="login__form">
                  <LoginForm />
                  <div className="login__register-now">
                    <p>
                      {isFa ? "هنوز حساب کاربری ندارید؟" : "Don’t have an account?"}{" "}
                      <Link href={withLocalePath("/register", locale)}>
                        {isFa ? "ثبت‌نام کنید" : "Register Now"}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginArea;
