'use client';
import React from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import * as Yup from "yup";
// internal
import { useChangePasswordMutation } from "src/redux/features/auth/authApi";
import ErrorMessage from "@components/error-message/error";
import { notifyError, notifySuccess } from "@utils/toast";
import { getLocaleFromPathname } from "@lib/locale-path";

const ChangePassword = () => {
  const { user } = useSelector((state) => state.auth);
  const [changePassword, {}] = useChangePasswordMutation();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const schema = Yup.object().shape({
    email: Yup.string()
      .required(isFa ? "ایمیل الزامی است." : "Email is required.")
      .email(isFa ? "ایمیل وارد شده معتبر نیست." : "Email must be valid."),
    password: Yup.string()
      .required(isFa ? "رمز عبور فعلی الزامی است." : "Current password is required.")
      .min(6, isFa ? "رمز عبور باید حداقل ۶ کاراکتر باشد." : "Password must be at least 6 characters."),
    newPassword: Yup.string()
      .required(isFa ? "رمز عبور جدید الزامی است." : "New password is required.")
      .min(6, isFa ? "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." : "New password must be at least 6 characters."),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("newPassword"), null], isFa ? "تکرار رمز عبور با رمز جدید یکسان نیست." : "Passwords must match"),
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

  // on submit
  const onSubmit = (data) => {
    changePassword({
      email: user?.email,
      password: data.password,
      newPassword: data.newPassword,
    }).then((result) => {
      if (result?.error) {
        notifyError(isFa ? "تغییر رمز عبور هنوز فعال نیست." : result?.error?.data?.message)
      }
      else {
        notifySuccess(isFa ? "رمز عبور با موفقیت تغییر کرد." : result?.data?.message)
      }
    });
    reset();
  };
  return (
    <div className="profile__password">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="row">
          <div className="col-xxl-12">
            <div className="profile__input-box">
              <h4>{isFa ? "ایمیل" : "Email Address"}</h4>
              <div className="profile__input">
                <input
                  {...register("email", { required: `Email is required!` })}
                  type="email"
                  defaultValue={user?.email}
                  placeholder={isFa ? "ایمیل خود را وارد کنید" : "Enter Email Address"}
                />
                <ErrorMessage message={errors.email?.message} />
              </div>
            </div>
          </div>
          <div className="col-xxl-12">
            <div className="profile__input-box">
              <h4>{isFa ? "رمز عبور فعلی" : "Current Password"}</h4>
              <div className="profile__input">
                <input
                  {...register("password", {
                    required: isFa ? "رمز عبور فعلی الزامی است." : "Password is required!",
                  })}
                  type="text"
                  placeholder={isFa ? "رمز عبور فعلی را وارد کنید" : "Enter current password"}
                />
                <ErrorMessage message={errors.password?.message} />
              </div>
            </div>
          </div>
          <div className="col-xxl-6 col-md-6">
            <div className="profile__input-box">
              <h4>{isFa ? "رمز عبور جدید" : "New Password"}</h4>
              <div className="profile__input">
                <input
                  {...register("newPassword", {
                    required: isFa ? "رمز عبور جدید الزامی است." : "New Password is required!",
                  })}
                  type="text"
                  placeholder={isFa ? "رمز عبور جدید را وارد کنید" : "Enter new password"}
                />
                <ErrorMessage message={errors.newPassword?.message} />
              </div>
            </div>
          </div>
          {/* confirm password */}
          <div className="col-xxl-6 col-md-6">
            <div className="profile__input-box">
              <h4>{isFa ? "تکرار رمز عبور" : "Confirm Password"}</h4>
              <div className="profile__input">
                <input
                  {...register("confirmPassword")}
                  type="text"
                  placeholder={isFa ? "رمز عبور جدید را تکرار کنید" : "Confirm Password"}
                />
                <ErrorMessage message={errors.confirmPassword?.message} />
              </div>
            </div>
          </div>
          <div className="col-xxl-6 col-md-6">
            <div className="profile__btn">
              <button type="submit" className="tp-btn-3">
                {isFa ? "به‌روزرسانی" : "Update"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
