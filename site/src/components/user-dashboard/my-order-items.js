import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dayjs from "dayjs";
import Pagination from "@ui/Pagination";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const MyOrderItems = ({ items, itemsPerPage }) => {
  const [currentItems, setCurrentItems] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [itemOffset, setItemOffset] = useState(0);
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  useEffect(() => {
    const endOffset = itemOffset + itemsPerPage;
    setCurrentItems(items?.slice(itemOffset, endOffset));
    setPageCount(Math.ceil(items.length / itemsPerPage));
  }, [itemOffset, itemsPerPage, items]);

  const handlePageClick = (event) => {
    const newOffset = (event.selected * itemsPerPage) % items.length;
    setItemOffset(newOffset);
  };

  return (
    <React.Fragment>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{isFa ? "شماره سفارش" : "Order Number"}</th>
            <th scope="col">{isFa ? "زمان سفارش" : "Order Time"}</th>
            <th scope="col">{isFa ? "وضعیت" : "Status"}</th>
            <th scope="col">{isFa ? "مشاهده" : "View"}</th>
          </tr>
        </thead>
        <tbody>
          {currentItems &&
            currentItems.map((item) => (
              <tr key={item._id}>
                <th className="text-uppercase" scope="row">
                  #{item.orderNumber ?? item._id}
                </th>
                <td data-info="title">
                  {formatOrderDate(item?.createdAt, locale)}
                </td>
                <td className={`status ${statusClass(item?.status)}`}>
                  {translateOrderStatus(item?.status, locale)}
                </td>
                <td>
                  <Link href={withLocalePath(`/order/${item._id}`, locale)} className="tp-btn">
                    {isFa ? "فاکتور" : "Invoice"}
                  </Link>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {items.length > itemsPerPage && (
        <div className="mt-20 ml-20 tp-pagination tp-pagination-style-2">
          <Pagination handlePageClick={handlePageClick} pageCount={pageCount} />
        </div>
      )}
    </React.Fragment>
  );
};

function statusClass(status) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("processing")) return "hold";
  if (normalized.includes("paid") || normalized.includes("delivered")) return "done";
  return "";
}

function formatOrderDate(value, locale) {
  if (!value) {
    return "-";
  }

  if (locale === "fa") {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  }

  return dayjs(value).format("MMMM D, YYYY");
}

function translateOrderStatus(status, locale) {
  if (locale !== "fa") {
    return status ?? "-";
  }

  const labels = {
    pending: "در انتظار",
    pendingpayment: "در انتظار پرداخت",
    processing: "در حال پردازش",
    paid: "پرداخت‌شده",
    delivered: "تحویل‌شده",
    cancelled: "لغوشده",
  };

  const normalized = String(status ?? "").toLowerCase();
  return labels[normalized] ?? status ?? "-";
}

export default MyOrderItems;
