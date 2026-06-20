'use client';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
// internal
import logo from '@assets/img/logo/logo-black.svg';
import payment from '@assets/img/footer/footer-payment.png';
import SocialLinks from "@components/social";
import CopyrightText from "./copyright-text";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

// single widget
function SingleWidget({ col, col_2, col_3, title, contents, locale }) {
  return (
    <div
      className={`col-xxl-${col} col-xl-${col} col-lg-3 col-md-${col_2} col-sm-6"`}
    >
      <div className={`footer__widget mb-50 footer-col-11-${col_3}`}>
        <h3 className="footer__widget-title">{title}</h3>
        <div className="footer__widget-content">
          <ul>
            {contents.map((l, i) => (
              <li key={i}>
                <Link href={withLocalePath(`/${l.url}`, locale)}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const Footer = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const copy = isFa
    ? {
        intro: "وندورا تولیدکننده تخصصی کیف‌های باکیفیت، اقتصادی و آماده ارسال برای خرید آنلاین است.",
        company: "شرکت",
        companyLinks: [
          { url: "about", title: "درباره ما" },
          { url: "contact", title: "تماس با ما" },
          { url: "shop", title: "فروشگاه" },
          { url: "faq", title: "سوالات متداول" },
          { url: "policy", title: "حریم خصوصی" },
        ],
        shop: "فروشگاه",
        shopLinks: [
          { url: "shop", title: "همه محصولات" },
          { url: "wishlist", title: "علاقه‌مندی‌ها" },
          { url: "cart", title: "سبد خرید" },
          { url: "checkout", title: "تسویه حساب" },
          { url: "terms", title: "قوانین" },
        ],
        support: "پشتیبانی",
        supportLinks: [
          { url: "faq", title: "راهنما" },
          { url: "contact", title: "پیگیری سفارش" },
          { url: "contact", title: "ارسال و تحویل" },
          { url: "contact", title: "مرجوعی" },
          { url: "contact", title: "پشتیبانی" },
        ],
        talk: "با ما صحبت کنید",
        talkText: "برای سفارش عمده، تولید اختصاصی یا پشتیبانی خرید با ما تماس بگیرید.",
      }
    : {
        intro: "Vendora produces high-quality, affordable bags ready for online orders and fast shipping.",
        company: "Company",
        companyLinks: [
          { url: "about", title: "About us" },
          { url: "contact", title: "Contact" },
          { url: "shop", title: "Shop" },
          { url: "faq", title: "FAQs" },
          { url: "policy", title: "Privacy Policy" },
        ],
        shop: "Shop",
        shopLinks: [
          { url: "shop", title: "All products" },
          { url: "wishlist", title: "Wishlist" },
          { url: "cart", title: "Cart" },
          { url: "checkout", title: "Checkout" },
          { url: "terms", title: "Terms" },
        ],
        support: "Support",
        supportLinks: [
          { url: "faq", title: "Help" },
          { url: "contact", title: "Track Order" },
          { url: "contact", title: "Shipping" },
          { url: "contact", title: "Returns" },
          { url: "contact", title: "Support" },
        ],
        talk: "Talk To Us",
        talkText: "Contact us for wholesale orders, custom manufacturing, or purchase support.",
      };

  return (
    <>
      <footer>
        <div
          className="footer__area footer__style-4"
          data-bg-color="footer-bg-white"
        >
          <div className="footer__top">
            <div className="container">
              <div className="row">
                <div className="col-xxl-3 col-xl-3 col-lg-3 col-md-5 col-sm-6">
                  <div className="footer__widget footer__widget-11 mb-50 footer-col-11-1">
                    <div className="footer__logo">
                      <Link href={withLocalePath("/", locale)}>
                        <Image src={logo} alt="logo" />
                      </Link>
                    </div>

                    <div className="footer__widget-content">
                      <div className="footer__info">
                        <p>{copy.intro}</p>
                        <div className="footer__social footer__social-11">
                          <SocialLinks/>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <SingleWidget
                  col="2"
                  col_2="4"
                  col_3="2"
                  title={copy.company}
                  locale={locale}
                  contents={copy.companyLinks}
                />
                <SingleWidget
                  col="3"
                  col_2="3"
                  col_3="3"
                  title={copy.shop}
                  locale={locale}
                  contents={copy.shopLinks}
                />
                <SingleWidget
                  col="1"
                  col_2="3"
                  col_3="4"
                  title={copy.support}
                  locale={locale}
                  contents={copy.supportLinks}
                />

                <div className="col-xxl-3 col-xl-3 col-lg-3 col-md-5 col-sm-6">
                  <div className="footer__widget mb-50 footer-col-11-5">
                    <h3 className="footer__widget-title">{copy.talk}</h3>

                    <div className="footer__widget-content">
                      <p className="footer__text">
                        {copy.talkText}
                      </p>
                      <div className="footer__contact">
                        <div className="footer__contact-call">
                          <span>
                            <a href="tel:624-423-26-72">+624 423 26 72</a>
                          </span>
                        </div>
                        <div className="footer__contact-mail">
                          <span>
                            <a href="mailto:support@vendora.local">
                              support@vendora.local
                            </a>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="footer__bottom">
            <div className="container">
              <div className="footer__bottom-inner">
                <div className="row">
                  <div className="col-sm-6">
                    <div className="footer__copyright">
                      <CopyrightText />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="footer__payment text-sm-end">
                      <Image src={payment} alt="payment" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
