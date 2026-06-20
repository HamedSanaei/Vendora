import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import menu_data from './menu-data';
import { getLocaleFromPathname, withLocalePath } from '@lib/locale-path';

const Menus = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const getTitle = (item) => (locale === 'fa' ? item.titleFa || item.title : item.title);

  return (
    <ul>
      {menu_data.map((menu, i) => (
        <li key={i} className={`${menu.hasDropdown ? 'has-dropdown' : ''}`}>
          <Link href={withLocalePath(menu.link, locale)}>
            {getTitle(menu)}
          </Link>
          {menu.hasDropdown && <ul className="submenu">
            {menu.submenus.map((sub, i) => (
              <li key={i}>
                <Link href={withLocalePath(sub.link, locale)}>
                  {getTitle(sub)}
                </Link>
              </li>
            ))}
          </ul>}
        </li>
      ))}

    </ul>
  );
};

export default Menus;
