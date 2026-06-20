'use client';
import { useState } from "react";
import { usePathname } from "next/navigation";
// internal
import Wrapper from "@layout/wrapper";
import Header from "@layout/header";
import ShopCta from "@components/cta";
import Footer from "@layout/footer";
import NiceSelect from "@ui/NiceSelect";
import ErrorMessage from "@components/error-message/error";
import SingleProduct from "@components/products/single-product";
import ProductLoader from "@components/loader/product-loader";
import EmptyCart from "@components/common/sidebar/cart-sidebar/empty-cart";
import { useGetShowingProductsQuery } from "src/redux/features/productApi";
import LoadMoreBtn from "@components/load-more-btn";
import BreadcrumbTwo from "@components/common/breadcrumb/breadcrumb-2";
import { getLocaleFromPathname } from "@lib/locale-path";

export default function SearchAreaMain({ searchText }) {
  const locale = getLocaleFromPathname(usePathname());
  const isFa = locale === "fa";
  const { data: products, isError, isLoading } = useGetShowingProductsQuery();
  const [shortValue, setShortValue] = useState("");
  const perView = 8;
  const [next, setNext] = useState(perView);

  // selectShortHandler
  const shortHandler = (e) => {
    setShortValue(e.value);
  };

  //   handleLoadMore
  const handleLoadMore = () => {
    setNext((value) => value + 4);
  };

  // decide what to render
  let content = null;
  if (isLoading) {
    content = <ProductLoader loading={isLoading} />;
  }

  if (!isLoading && isError) {
    content = <ErrorMessage message={isFa ? "خطایی رخ داد" : "There was an error"} />;
  }

  if (!isLoading && !isError && products?.products?.length === 0) {
    content = <ErrorMessage message={isFa ? "محصولی پیدا نشد" : "No products found!"} />;
  }

  if (!isLoading && !isError && products?.products?.length > 0) {
    let all_products = products.products;
    let product_items = all_products.filter((prd) =>
      prd.title.toLowerCase().includes(searchText?.toLowerCase())
    );
    // Price low to high
    if (shortValue === "Price low to high") {
      product_items = all_products
        .slice()
        .sort((a, b) => Number(a.originalPrice) - Number(b.originalPrice));
    }
    // Price high to low
    if (shortValue === "Price high to low") {
      product_items = all_products
        .slice()
        .sort((a, b) => Number(b.originalPrice) - Number(a.originalPrice));
    }
    if (product_items.length === 0) {
      content = (
        <div className="pb-100">
          <EmptyCart search_prd={true} />
        </div>
      );
    } else {
      content = (
        <section className="shop__area pb-60 pt-100">
          <div className="container">
            <div className="shop__top mb-50">
              <div className="row align-items-center">
                <div className="col-lg-6 col-md-5">
                  <div className="shop__result">
                    <p>
                      {isFa
                        ? `${new Intl.NumberFormat("fa-IR").format(product_items.length)} محصول پیدا شد`
                        : `Total ${product_items.length} items found`}
                    </p>
                  </div>
                </div>
                <div className="col-lg-6 col-md-7">
                  <div className="shop__sort d-flex flex-wrap justify-content-md-end align-items-center">
                    <div className="shop__sort-item">
                      <div className="shop__sort-select">
                        <NiceSelect
                          options={[
                            { value: "Short By Price", text: isFa ? "مرتب‌سازی قیمت" : "Sort by price" },
                            {
                              value: "Price low to high",
                              text: isFa ? "ارزان‌ترین" : "Price low to high",
                            },
                            {
                              value: "Price high to low",
                              text: isFa ? "گران‌ترین" : "Price high to low",
                            },
                          ]}
                          defaultCurrent={0}
                          onChange={shortHandler}
                          name="Short By Price"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="shop__main">
              <div className="row">
                {product_items?.slice(0, next)?.map((product) => (
                  <div
                    key={product._id}
                    className="col-xl-3 col-lg-4 col-md-6 col-sm-6"
                  >
                    <SingleProduct product={product} />
                  </div>
                ))}
              </div>
            </div>
            {next < product_items?.length && (
              <div className="row">
                <div className="col-xxl-12">
                  <LoadMoreBtn handleLoadMore={handleLoadMore} />
                </div>
              </div>
            )}
          </div>
        </section>
      );
    }
  }

  return (
    <Wrapper>
      <Header style_2={true}/>
      <BreadcrumbTwo title={isFa ? "نتیجه جستجو" : "Search Result"} />
      {content}
      <ShopCta />
      <Footer />
    </Wrapper>
  );
}
