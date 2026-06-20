import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// internal
import menu_data from "@layout/menu-data";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const MobileMenus = () => {
  const [subMenu, setSubMenu] = useState("");
  const [navTitle, setNavTitle] = useState("");
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const getTitle = (item) => (locale === "fa" ? item.titleFa || item.title : item.title);

  //openMobileMenu
  const openMobileMenu = (menu) => {
    if (navTitle === menu) {
      setNavTitle("");
    } else {
      setNavTitle(menu);
    }
  };
  return (
    <nav className="mean-nav">
      <ul>
        {menu_data.map((menu, i) => (
          <React.Fragment key={i}>
            {!menu.hasDropdown &&<li>
              <Link href={withLocalePath(menu.link, locale)}>{getTitle(menu)}</Link>
            </li>}
            {menu.hasDropdown && (
              <li className="has-dropdown">
                <Link href={withLocalePath(menu.link, locale)}>{getTitle(menu)}</Link>
                <ul
                  className="submenu"
                  style={{
                    display: navTitle === getTitle(menu) ? "block" : "none",
                  }}
                >
                  {menu.submenus.map((sub, i) => (
                    <li key={i}>
                      <Link href={withLocalePath(sub.link, locale)}>{getTitle(sub)}</Link>
                    </li>
                  ))}
                </ul>
                <a
                  className={`mean-expand ${
                    navTitle === menu.title ? "mean-clicked" : ""
                  }`}
                  href="#"
                  onClick={() => openMobileMenu(getTitle(menu))}
                  style={{ fontSize: "18px" }}
                >
                  <i className="fal fa-plus"></i>
                </a>
              </li>
            )}
          </React.Fragment>
        ))}
      </ul>
    </nav>
  );
};

export default MobileMenus;
