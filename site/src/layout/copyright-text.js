'use client';
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const CopyrightText = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);

  return (
    <p>
      Copyright © {new Date().getFullYear()} by{" "}
      <Link href={withLocalePath("/", locale)}>Hamart</Link> All rights
      reserved.
    </p>
  );
};

export default CopyrightText;
