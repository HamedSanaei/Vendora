'use client';
import { usePathname } from "next/navigation";
import { useState } from "react";
// internal
import bg from "@assets/img/cta/13/cta-bg-1.jpg";
import { getLocaleFromPathname } from "@lib/locale-path";
import { subscribeToNewsletter } from "@lib/newsletter-api";

const copy = {
  fa: {
    title: (
      <>
        برای دریافت <br />
        جدیدترین مدل‌ها و پیشنهادها عضو شوید
      </>
    ),
    placeholder: "ایمیل خود را وارد کنید",
    button: "عضویت",
    required: "لطفاً ایمیل خود را وارد کنید.",
    invalid: "ایمیل وارد شده معتبر نیست.",
    success: "ایمیل شما با موفقیت ثبت شد.",
    already: "این ایمیل قبلاً ثبت شده است.",
    failed: "ثبت ایمیل انجام نشد. دوباره تلاش کنید.",
  },
  en: {
    title: (
      <>
        Subscribe for <br />
        Latest Trends & Offers
      </>
    ),
    placeholder: "Enter Your Email",
    button: "Subscribe",
    required: "Please enter your email.",
    invalid: "Please enter a valid email.",
    success: "Your email was subscribed successfully.",
    already: "This email is already subscribed.",
    failed: "Could not subscribe this email. Please try again.",
  },
};

const ShopCta = () => {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const isFa = locale === "fa";
  const text = copy[locale];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    setMessage("");

    if (!normalizedEmail) {
      setMessageType("error");
      setMessage(text.required);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessageType("error");
      setMessage(text.invalid);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await subscribeToNewsletter(normalizedEmail, locale);
      setMessageType("success");
      setMessage(result.message?.toLowerCase().includes("already") ? text.already : text.success);
      setEmail("");
    } catch {
      setMessageType("error");
      setMessage(text.failed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="cta__area pt-50 pb-50 p-relative include-bg jarallax"
      style={{ backgroundImage: `url(${bg.src})` }}
      dir={isFa ? "rtl" : "ltr"}
    >
      <div className="container">
        <div className="cta__inner-13 white-bg">
          <div className="row align-items-center">
            <div className="col-xl-6 col-lg-6">
              <div className="cta__content-13">
                <h3 className="cta__title-13">
                  {text.title}
                </h3>
              </div>
            </div>
            <div className="col-xl-6 col-lg-6">
              <div className="cta__form-13">
                <form onSubmit={handleSubmit}>
                  <div className="cta__input-13">
                    <input
                      type="email"
                      value={email}
                      placeholder={text.placeholder}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <button type="submit" className="tp-btn" disabled={isSubmitting}>
                      {isSubmitting ? "..." : text.button}
                    </button>
                  </div>
                  {message ? (
                    <p className={`cta__message-13 cta__message-13-${messageType}`}>
                      {message}
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShopCta;
