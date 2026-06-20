'use client';
import React, { useState } from "react";
import Search from "@svg/search";
import { usePathname, useRouter } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const SearchForm = () => {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const [searchText, setSearchText] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchText) {
      router.push(withLocalePath(`/search?query=${encodeURIComponent(searchText)}`, locale));
      setSearchText("");
    } else {
      router.push(withLocalePath("/", locale));
      setSearchText("");
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <div className="header__search-input-13 d-none d-xxl-block">
        <input
          onChange={(e) => setSearchText(e.target.value)}
          value={searchText}
          type="text"
          placeholder={isFa ? "جستجوی محصول..." : "Search for products..."}
        />
        <button type="submit">
          <Search />
        </button>
      </div>
    </form>
  );
};

export default SearchForm;
