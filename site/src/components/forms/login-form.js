'use client';
import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
// internal
import { EyeCut, Lock, UserTwo } from "@svg/index";
import ErrorMessage from "@components/error-message/error";
import { useLoginUserMutation } from "src/redux/features/auth/authApi";
import { notifyError, notifySuccess } from "@utils/toast";
import { usePathname, useRouter } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const LoginForm = () => {
  const [showPass, setShowPass] = useState(false);
  const [loginUser, {}] = useLoginUserMutation();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const schema = Yup.object().shape({
    email: Yup.string()
      .required(isFa ? "ایمیل الزامی است." : "Email is required.")
      .email(isFa ? "ایمیل وارد شده معتبر نیست." : "Email must be valid."),
    password: Yup.string()
      .required(isFa ? "رمز عبور الزامی است." : "Password is required.")
      .min(6, isFa ? "رمز عبور باید حداقل ۶ کاراکتر باشد." : "Password must be at least 6 characters."),
  });
  // react hook form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(schema),
  });
  // onSubmit
  const onSubmit = (data) => {
    loginUser({
      email: data.email,
      password: data.password,
    })
      .then((data) => {
        if(data?.error){
          notifyError(data?.error?.data?.error ?? data?.error?.data?.message ?? (isFa ? "ورود ناموفق بود." : "Login failed."));
        }
        else {
          notifySuccess(isFa ? "با موفقیت وارد شدید." : "Login successfully");
          setTimeout(() => {
            router.push(withLocalePath("/", locale));
          },500)
        }
      })
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="login__input-wrapper">
        <div className="login__input-item">
          <div className="login__input">
            <input
              {...register("email")}
              name="email"
              type="email"
              placeholder={isFa ? "ایمیل خود را وارد کنید" : "Enter your email"}
              id="email"
            />
            <span>
              <UserTwo />
            </span>
          </div>
          <ErrorMessage message={errors.email?.message} />
        </div>

        <div className="login__input-item">
          <div className="login__input-item-inner p-relative">
            <div className="login__input">
              <input
                {...register("password")}
                name="password"
                type={showPass ? "text" : "password"}
                placeholder={isFa ? "رمز عبور" : "Password"}
                id="password"
              />
              <span>
                <Lock />
              </span>
            </div>
            <span
              className="login-input-eye"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <i className="fa-regular fa-eye"></i> : <EyeCut />}
            </span>
            {/* error msg start */}
            <ErrorMessage message={errors.password?.message} />
            {/* error msg end */}
          </div>
        </div>
      </div>

      <div className="login__option mb-25 d-sm-flex justify-content-between">
        <div className="login__remember">
          <input type="checkbox" id="tp-remember" />
          <label htmlFor="tp-remember">{isFa ? "مرا به خاطر بسپار" : "Remember me"}</label>
        </div>
        <div className="login__forgot">
          <Link href={withLocalePath("/forgot", locale)}>{isFa ? "رمز عبور را فراموش کرده‌اید؟" : "Forgot password?"}</Link>
        </div>
      </div>
      <div className="login__btn">
        <button type="submit" className="tp-btn w-100">
          {isFa ? "ورود" : "Sign In"}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
