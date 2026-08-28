'use client';
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Navigation } from "swiper";
// internal
import slider_img_1 from "@assets/img/slider/13/slider-5.png";
import slider_img_2 from "@assets/img/slider/13/slider-6-clean.png";
import slider_img_3 from "@assets/img/slider/13/slider-7-clean.png";
import { RightArrow } from "@svg/index";
import { getLocaleFromPathname, withLocalePath } from "@lib/locale-path";

const slider_data = {
  fa: [
    {
      id: 1,
      pre_title: "کیف‌های روزمره و اداری",
      title: (
        <>
          همراه شیک <br /> برای هر روز شما
        </>
      ),
      buttonText: "مشاهده محصولات",
      alt: "کیف دستی مشکی زنانه",
      img: slider_img_1,
      imageMode: "cover",
    },
    {
      id: 2,
      pre_title: "کاورهای تخصصی و مقاوم",
      title: (
        <>
          محافظت مطمئن <br /> برای تجهیزات شما
        </>
      ),
      buttonText: "مشاهده کاورها",
      alt: "کاور بلند مشکی برای تجهیزات",
      img: slider_img_2,
      imageMode: "contain",
      imagePosition: "case",
    },
    {
      id: 3,
      pre_title: "کوله‌پشتی‌های سفر",
      title: (
        <>
          آماده مسیرهای <br /> طولانی و سخت
        </>
      ),
      buttonText: "خرید کوله‌پشتی",
      alt: "کوله پشتی بزرگ سفری",
      img: slider_img_3,
      imageMode: "contain",
      imagePosition: "backpack",
    },
  ],
  en: [
    {
      id: 1,
      pre_title: "Everyday and office bags",
      title: (
        <>
          A polished carry <br /> for every day
        </>
      ),
      buttonText: "Shop Bags",
      alt: "Black women's handbag",
      img: slider_img_1,
      imageMode: "cover",
    },
    {
      id: 2,
      pre_title: "Specialized protective cases",
      title: (
        <>
          Reliable protection <br /> for your gear
        </>
      ),
      buttonText: "Shop Cases",
      alt: "Long black protective equipment case",
      img: slider_img_2,
      imageMode: "contain",
      imagePosition: "case",
    },
    {
      id: 3,
      pre_title: "Travel backpacks",
      title: (
        <>
          Ready for long <br /> demanding routes
        </>
      ),
      buttonText: "Shop Backpacks",
      alt: "Large travel backpack",
      img: slider_img_3,
      imageMode: "contain",
      imagePosition: "backpack",
    },
  ],
};

const HeroBanner = () => {
  const [loop,setLoop] = useState(false);
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const slides = slider_data[locale] ?? slider_data.en;
  useEffect(() => setLoop(true),[]);
  return (
    <>
      <section className="slider__area">
        <Swiper
          className="slider__active slider__active-13 swiper-container"
          slidesPerView={1}
          spaceBetween={0}
          effect="fade"
          loop={loop}
          speed={900}
          autoplay={{
            delay: 4500,
            disableOnInteraction: false,
          }}
          navigation={{
            nextEl: ".slider__button-next-13",
            prevEl: ".slider__button-prev-13",
          }}
          modules={[Autoplay, EffectFade, Navigation]}
        >
          {slides.map((item) => (
            <SwiperSlide
              key={item.id}
              className="slider__item-13 slider__height-13 grey-bg-17 d-flex align-items-end"
            >
              <div className="container">
                <div className="row align-items-center slider__row-13">
                  <div className="col-xl-6 col-lg-6">
                    <div className="slider__content-13">
                      <span className="slider__title-pre-13">
                        {item.pre_title}
                      </span>
                      <h3 className="slider__title-13">{item.title}</h3>

                      <div className="slider__btn-13 ">
                        <Link href={withLocalePath("/shop", locale)} className="tp-btn-border">
                          {item.buttonText}
                          <span>
                            <RightArrow />
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-6 col-lg-6">
                    <div className="slider__thumb-13 text-end mr-40">
                      <span className="slider__thumb-13-circle-1"></span>
                      <span className="slider__thumb-13-circle-2"></span>
                      <Image
                        src={item.img}
                        alt={item.alt}
                        className={`slider__thumb-13-img slider__thumb-13-img--${item.imageMode} slider__thumb-13-img--${item.imagePosition ?? "center"}`}
                        priority={item.id === 1}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
          <button
            aria-label={locale === "fa" ? "اسلاید قبلی" : "Previous slide"}
            className="slider__button-13 slider__button-prev-13"
            type="button"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            aria-label={locale === "fa" ? "اسلاید بعدی" : "Next slide"}
            className="slider__button-13 slider__button-next-13"
            type="button"
          >
            <span aria-hidden="true">›</span>
          </button>
        </Swiper>
      </section>
    </>
  );
};

export default HeroBanner;
