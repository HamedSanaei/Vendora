'use client';
// external
import Link from "next/link";
import { usePathname } from "next/navigation";
// internal
import Wrapper from "@layout/wrapper";
import Header from "@layout/header";
import {ErrorSvg, RightArrowThree} from "@svg/index";
import ShopCta from "@components/cta";
import Footer from "@layout/footer";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

export default function NotFound() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  return (
    <Wrapper>
      <Header style_2={true} />
      {/* error area start */}
      <section className="error__area error__bg pb-110">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-6 col-lg-8 col-md-10">
              <div className="error__wrapper p-relative z-index-1 text-center">
                <h3 className="error__text">404</h3>
                <div className="error__thumb mb-35">
                  <ErrorSvg />
                </div>
                <div className="error__content">
                  <h3 className="error__title">{isFa ? "صفحه پیدا نشد" : "Oops! Page not found"}</h3>
                  <p>
                    {isFa
                      ? "متاسفانه صفحه‌ای که دنبالش بودید پیدا نشد یا آدرس آن تغییر کرده است."
                      : "Whoops, this is embarrassing. Looks like the page you were looking for was not found."}
                  </p>
                  <Link href={withLocalePath("/", locale)} className="tp-btn">
                    {isFa ? "بازگشت به خانه" : "Back to Home"}
                    <RightArrowThree/>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* error area end */}
      <ShopCta/>
      <Footer/>
    </Wrapper>
  );
}
