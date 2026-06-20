import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useDispatch } from "react-redux";
import { userLoggedOut } from "src/redux/features/auth/authSlice";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const ProfileNav = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  const handleLogout = () => {
    dispatch(userLoggedOut());
    router.push(withLocalePath("/login", locale));
  };

  return (
    <div className="profile__tab mr-40">
      <nav>
        <div
          className="nav nav-tabs tp-tab-menu flex-column"
          id="profile-tab"
          role="tablist"
        >
          <ProfileNavButton
            id="nav-profile-tab"
            target="#nav-profile"
            icon="fa-regular fa-user-pen"
            label={isFa ? "پروفایل" : "Profile"}
            active
          />
          <ProfileNavButton
            id="nav-order-tab"
            target="#nav-order"
            icon="fa-light fa-clipboard-list-check"
            label={isFa ? "سفارش‌های من" : "My Orders"}
          />
          <ProfileNavButton
            id="nav-information-tab"
            target="#nav-information"
            icon="fa-regular fa-circle-info"
            label={isFa ? "اطلاعات حساب" : "Information"}
          />
          <ProfileNavButton
            id="nav-addresses-tab"
            target="#nav-addresses"
            icon="fa-regular fa-location-dot"
            label={isFa ? "آدرس‌ها" : "Addresses"}
          />
          <ProfileNavButton
            id="nav-password-tab"
            target="#nav-password"
            icon="fa-regular fa-lock"
            label={isFa ? "تغییر رمز عبور" : "Change Password"}
          />
          <button onClick={handleLogout} className="nav-link" type="button">
            <span>
              <i className="fa-light fa-arrow-right-from-bracket"></i>
            </span>
            {isFa ? "خروج" : "Logout"}
          </button>
          <span
            id="marker-vertical"
            className="tp-tab-line d-none d-sm-inline-block"
          ></span>
        </div>
      </nav>
    </div>
  );
};

const ProfileNavButton = ({ id, target, icon, label, active = false }) => (
  <button
    className={`nav-link${active ? " active" : ""}`}
    id={id}
    data-bs-toggle="tab"
    data-bs-target={target}
    type="button"
    role="tab"
    aria-controls={target.replace("#", "")}
    aria-selected={active ? "true" : "false"}
  >
    <span>
      <i className={icon}></i>
    </span>
    {label}
  </button>
);

export default ProfileNav;
