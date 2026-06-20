import React from "react";
import { usePathname } from "next/navigation";
import { NextArrow, PrevArrow } from "@svg/index";
import ReactPaginate from "react-paginate";
import { getLocaleFromPathname } from "@lib/locale-path";

const Pagination = ({ handlePageClick, pageCount, focusPage }) => {
  const locale = getLocaleFromPathname(usePathname());
  const numberFormatter = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US");

  return (
    <ReactPaginate
      nextLabel={
        <span className="next page-numbers">
          Next{" "}<NextArrow />
        </span>
      }
      previousLabel={
        <span className="tp-pagination-prev prev page-numbers">
          <PrevArrow />{" "}Prev
        </span>
      }
      onPageChange={handlePageClick}
      pageRangeDisplayed={3}
      marginPagesDisplayed={2}
      forcePage={focusPage}
      pageCount={pageCount}
      pageLabelBuilder={(page) => numberFormatter.format(page)}
      pageClassName="page-items"
      pageLinkClassName="page-links"
      previousClassName="page-items"
      previousLinkClassName="page-links"
      nextClassName="page-items"
      nextLinkClassName="page-links"
      breakLabel="..."
      breakClassName="page-items"
      breakLinkClassName="page-links"
      containerClassName="paginasstions"
      activeClassName="current"
      renderOnZeroPageCount={null}
    />
  );
};

export default Pagination;
