'use client';
import React, { useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import * as Yup from "yup";
import { EmailTwo, MobileTwo, UserTwo } from "@svg/index";
import { useUpdateProfileMutation } from "src/redux/features/auth/authApi";
import { notifyError, notifySuccess } from "@utils/toast";
import ErrorMessage from "@components/error-message/error";
import { getLocaleFromPathname } from "@lib/locale-path";

const UpdateUser = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const { user } = useSelector((state) => state.auth);
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const schema = Yup.object().shape({
    name: Yup.string().required(isFa ? "نام و نام خانوادگی الزامی است." : "Full name is required."),
    email: Yup.string()
      .required(isFa ? "ایمیل الزامی است." : "Email is required.")
      .email(isFa ? "ایمیل وارد شده معتبر نیست." : "Email must be valid."),
    phone: Yup.string()
      .transform((value) => normalizeDigits(value ?? ""))
      .required(isFa ? "شماره موبایل الزامی است." : "Phone number is required.")
      .matches(/^09\d{9}$/, isFa ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد." : "Phone must start with 09 and contain 11 digits."),
    bio: Yup.string().max(1000, isFa ? "توضیحات نباید بیشتر از ۱۰۰۰ کاراکتر باشد." : "Bio must be under 1000 characters."),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      bio: user?.bio ?? "",
    },
  });

  useEffect(() => {
    reset({
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      bio: user?.bio ?? "",
    });
  }, [reset, user]);

  const onSubmit = async (data) => {
    const result = await updateProfile({
      name: data.name,
      email: data.email,
      phone: normalizeDigits(data.phone),
      bio: data.bio,
    });

    if (result?.error) {
      notifyError(result.error?.data?.message ?? (isFa ? "به‌روزرسانی پروفایل انجام نشد." : "Profile update failed."));
      return;
    }

    notifySuccess(isFa ? "پروفایل با موفقیت به‌روزرسانی شد." : "Profile was updated successfully.");
  };

  return (
    <div className="profile__info">
      <h3 className="profile__info-title">{isFa ? "اطلاعات شخصی" : "Personal Details"}</h3>
      <div className="profile__info-content">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="row">
            <div className="col-xxl-6 col-md-6">
              <ProfileInput
                register={register}
                name="name"
                type="text"
                placeholder={isFa ? "نام و نام خانوادگی" : "Full name"}
                error={errors.name?.message}
                icon={<UserTwo />}
              />
            </div>

            <div className="col-xxl-6 col-md-6">
              <ProfileInput
                register={register}
                name="email"
                type="email"
                placeholder={isFa ? "ایمیل" : "Email address"}
                error={errors.email?.message}
                icon={<EmailTwo />}
              />
            </div>

            <div className="col-xxl-12">
              <ProfileInput
                register={register}
                name="phone"
                type="text"
                placeholder={isFa ? "شماره موبایل" : "Mobile number"}
                error={errors.phone?.message}
                icon={<MobileTwo />}
              />
            </div>

            <div className="col-xxl-12">
              <div className="profile__input-box">
                <div className="profile__input">
                  <textarea
                    {...register("bio")}
                    placeholder={isFa ? "توضیح کوتاهی درباره خودتان بنویسید" : "Write a short bio"}
                  />
                  <ErrorMessage message={errors.bio?.message} />
                </div>
              </div>
            </div>

            <div className="col-xxl-12">
              <div className="profile__btn">
                <button type="submit" className="tp-btn" disabled={isLoading}>
                  {isLoading ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "به‌روزرسانی پروفایل" : "Update Profile")}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProfileInput = ({ register, name, type, placeholder, error, icon }) => (
  <div className="profile__input-box">
    <div className="profile__input">
      <input {...register(name)} type={type} placeholder={placeholder} />
      <span>{icon}</span>
      <ErrorMessage message={error} />
    </div>
  </div>
);

function normalizeDigits(value = "") {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export default UpdateUser;
