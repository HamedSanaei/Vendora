"use client";
import { usePathname } from "next/navigation";
import { DotsTwo, General, Support } from "@svg/index";
import FaqThumb from "./faq-thumb";
import SingleFaq from "./single-faq";
import { getLocaleFromPathname } from "@lib/locale-path";

const enFaqTabs = [
  {
    id: "general",
    title: "General Questions",
    icon: <General />,
    active: true,
    sections: [
      {
        title: <>Orders <br />& Shipping</>,
        accordions: [
          {
            id: "general-one",
            title: "How can I place an order?",
            show: true,
            desc: "Choose your bag, add it to the cart, sign in, select or create a shipping address, and submit the order. Online payment will be connected in the next payment step.",
            parent: "general-1_accordion",
          },
          {
            id: "general-two",
            title: "Can I use more than one shipping address?",
            desc: "Yes. You can save multiple Iranian addresses in your account and choose one of them during checkout.",
            parent: "general-1_accordion",
          },
          {
            id: "general-three",
            title: "How is the shipping cost calculated?",
            desc: "Shipping cost is shown in Toman during checkout before you submit the order. The final amount is stored on the order invoice.",
            parent: "general-1_accordion",
          },
        ],
      },
      {
        title: <>Returns <br />& Exchanges</>,
        accordions: [
          {
            id: "general-four",
            title: "Can I return a product?",
            show: true,
            desc: "If the product has a manufacturing issue or does not match the confirmed order, contact support with your order number so the request can be reviewed.",
            parent: "general-2_accordion",
          },
          {
            id: "general-five",
            title: "Can I change my shipping address after ordering?",
            desc: "If the order has not entered the shipping process yet, support may be able to update the delivery information.",
            parent: "general-2_accordion",
          },
        ],
      },
      {
        title: "Discounts",
        accordions: [
          {
            id: "general-six",
            title: "How do coupon codes work?",
            show: true,
            desc: "Coupons can apply to all categories or selected categories. Each coupon may have a percentage discount, maximum Toman discount, and an expiration date.",
            parent: "general-3_accordion",
          },
        ],
      },
    ],
  },
  {
    id: "community",
    title: "Account",
    icon: <DotsTwo />,
    sections: [
      {
        title: <>Account <br />& Profile</>,
        accordions: [
          {
            id: "community-one",
            title: "Do I need an account to checkout?",
            show: true,
            desc: "Yes. Checkout is protected so your order history, invoice, and shipping addresses stay connected to your account.",
            parent: "community-1_accordion",
          },
          {
            id: "community-two",
            title: "Can I update my profile?",
            desc: "Yes. You can update your full name, email, mobile number, bio, and shipping addresses from the user dashboard.",
            parent: "community-1_accordion",
          },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    icon: <Support />,
    sections: [
      {
        title: "Support",
        accordions: [
          {
            id: "support-one",
            title: "How can I contact support?",
            show: true,
            desc: "Use the contact page and include your order number if your question is related to a purchase.",
            parent: "support-1_accordion",
          },
          {
            id: "support-two",
            title: "Where can I see my invoices?",
            desc: "After signing in, open your dashboard and go to My Orders. Each order has an invoice view.",
            parent: "support-1_accordion",
          },
        ],
      },
    ],
  },
];

const faFaqTabs = [
  {
    id: "general",
    title: "سوالات عمومی",
    icon: <General />,
    active: true,
    sections: [
      {
        title: <>سفارش <br />و ارسال</>,
        accordions: [
          {
            id: "general-one",
            title: "چطور می‌توانم سفارش ثبت کنم؟",
            show: true,
            desc: "محصول موردنظر را انتخاب کنید، به سبد خرید اضافه کنید، وارد حساب کاربری شوید، یک آدرس ارسال انتخاب یا ثبت کنید و سفارش را نهایی کنید. پرداخت آنلاین در قدم بعدی به همین سفارش متصل می‌شود.",
            parent: "general-1_accordion",
          },
          {
            id: "general-two",
            title: "آیا می‌توانم چند آدرس ارسال داشته باشم؟",
            desc: "بله. در حساب کاربری می‌توانید چند آدرس داخل ایران با کد پستی ثبت کنید و هنگام تسویه حساب یکی را انتخاب کنید.",
            parent: "general-1_accordion",
          },
          {
            id: "general-three",
            title: "هزینه ارسال چطور محاسبه می‌شود؟",
            desc: "هزینه ارسال قبل از ثبت سفارش در صفحه تسویه حساب و بر اساس تومان نمایش داده می‌شود و مبلغ نهایی در فاکتور سفارش ذخیره می‌گردد.",
            parent: "general-1_accordion",
          },
        ],
      },
      {
        title: <>مرجوعی <br />و تعویض</>,
        accordions: [
          {
            id: "general-four",
            title: "آیا امکان مرجوع کردن کالا وجود دارد؟",
            show: true,
            desc: "اگر محصول ایراد تولیدی داشته باشد یا با سفارش ثبت‌شده مغایرت داشته باشد، با شماره سفارش با پشتیبانی تماس بگیرید تا درخواست بررسی شود.",
            parent: "general-2_accordion",
          },
          {
            id: "general-five",
            title: "بعد از ثبت سفارش می‌توانم آدرس ارسال را تغییر بدهم؟",
            desc: "اگر سفارش هنوز وارد مرحله ارسال نشده باشد، پشتیبانی می‌تواند امکان اصلاح اطلاعات ارسال را بررسی کند.",
            parent: "general-2_accordion",
          },
        ],
      },
      {
        title: "تخفیف‌ها",
        accordions: [
          {
            id: "general-six",
            title: "کد تخفیف چطور اعمال می‌شود؟",
            show: true,
            desc: "کد تخفیف می‌تواند برای همه دسته‌بندی‌ها یا چند دسته‌بندی خاص تعریف شود. هر کد ممکن است درصد تخفیف، سقف تخفیف تومانی و تاریخ انقضا داشته باشد.",
            parent: "general-3_accordion",
          },
        ],
      },
    ],
  },
  {
    id: "community",
    title: "حساب کاربری",
    icon: <DotsTwo />,
    sections: [
      {
        title: <>حساب <br />و پروفایل</>,
        accordions: [
          {
            id: "community-one",
            title: "آیا برای خرید باید حساب کاربری داشته باشم؟",
            show: true,
            desc: "بله. مرحله تسویه حساب محافظت شده است تا تاریخچه سفارش‌ها، فاکتور و آدرس‌های ارسال به حساب شما متصل بمانند.",
            parent: "community-1_accordion",
          },
          {
            id: "community-two",
            title: "آیا می‌توانم اطلاعات پروفایل را ویرایش کنم؟",
            desc: "بله. از داشبورد کاربری می‌توانید نام، ایمیل، شماره موبایل، توضیح کوتاه پروفایل و آدرس‌های ارسال را مدیریت کنید.",
            parent: "community-1_accordion",
          },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "پشتیبانی",
    icon: <Support />,
    sections: [
      {
        title: "پشتیبانی",
        accordions: [
          {
            id: "support-one",
            title: "چطور با پشتیبانی تماس بگیرم؟",
            show: true,
            desc: "از صفحه تماس با ما پیام بدهید و اگر موضوع مربوط به خرید است، شماره سفارش را هم وارد کنید.",
            parent: "support-1_accordion",
          },
          {
            id: "support-two",
            title: "فاکتور سفارش‌ها را از کجا ببینم؟",
            desc: "بعد از ورود، وارد داشبورد کاربری شوید و از بخش سفارش‌های من، فاکتور هر سفارش را مشاهده کنید.",
            parent: "support-1_accordion",
          },
        ],
      },
    ],
  },
];

function NavItem({ active, id, title, icon }) {
  return (
    <button
      className={`nav-link ${active ? "active" : ""}`}
      id={`nav-${id}-tab`}
      data-bs-toggle="tab"
      data-bs-target={`#${id}`}
      type="button"
      role="tab"
      aria-controls={`nav-${id}`}
      aria-selected={active ? "true" : "false"}
      tabIndex="-1"
    >
      <span>{icon}</span>
      {title}
    </button>
  );
}

export function TabItem({ active, id, accordion_items }) {
  return (
    <div
      className={`tab-pane fade ${active ? "show active" : ""}`}
      id={`${id}`}
      role="tabpanel"
      aria-labelledby={`nav-${id}-tab`}
    >
      {accordion_items.map((item, index) => (
        <div key={`${id}-${index}`} className="faq__item pb-95">
          <div className="row">
            <div className="col-xl-3 col-lg-3 col-md-4">
              <div className="faq__content">
                <h3 className="faq__title-2">{item.title}</h3>
              </div>
            </div>
            <div className="col-xl-9 col-lg-9 col-md-8">
              <div className="faq__wrapper faq__style-4 tp-accordion">
                <div className="accordion" id={`${id}-${index + 1}_accordion`}>
                  {item.accordions.map((accordion) => (
                    <SingleFaq key={accordion.id} item={accordion} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const FaqArea = ({ element_faq = false }) => {
  const locale = getLocaleFromPathname(usePathname());
  const isFa = locale === "fa";
  const tabs = isFa ? faFaqTabs : enFaqTabs;

  return (
    <>
      {!element_faq && <FaqThumb />}

      <section className="faq__area pt-100 pb-25">
        <div className="container">
          <div className="row">
            <div className="col-xxl-12">
              <div className="faq__tab-2 tp-tab mb-50">
                <ul className="nav nav-tabs" id="myTab" role="tablist">
                  {tabs.map((tab) => (
                    <li key={tab.id} className="nav-item" role="presentation">
                      <NavItem
                        active={Boolean(tab.active)}
                        id={tab.id}
                        icon={tab.icon}
                        title={tab.title}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="faq__item-wrapper">
            <div className="tab-content" id="faqTabContent">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  active={Boolean(tab.active)}
                  id={tab.id}
                  accordion_items={tab.sections}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FaqArea;
