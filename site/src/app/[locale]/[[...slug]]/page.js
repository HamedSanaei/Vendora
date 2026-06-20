import { notFound } from "next/navigation";
import HomeContent from "../../home-content";
import AboutPage from "../../about/page";
import CartPage from "../../cart/page";
import CheckoutPage from "../../checkout/page";
import ContactPage from "../../contact/page";
import FaqPage from "../../faq/page";
import ForgotPage from "../../forgot/page";
import LoginPage from "../../login/page";
import PolicyPage from "../../policy/page";
import ProductDetailsPage from "../../product-details/[id]/page";
import RegisterPage from "../../register/page";
import SearchPage from "../../search/page";
import ShopPage from "../../shop/page";
import TermsPage from "../../terms/page";
import UserDashboardPage from "../../user-dashboard/page";
import WishlistPage from "../../wishlist/page";
import OrderPage from "../../order/[id]/page";

const locales = new Set(["fa", "en"]);

export default async function LocalizedStorefrontPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug ?? [];

  if (!locales.has(locale)) {
    notFound();
  }

  const path = slug.join("/");

  if (path === "") return <HomeContent />;
  if (path === "404") notFound();
  if (path === "about") return <AboutPage />;
  if (path === "cart") return <CartPage />;
  if (path === "checkout") return <CheckoutPage />;
  if (path === "contact") return <ContactPage />;
  if (path === "faq") return <FaqPage />;
  if (path === "forgot") return <ForgotPage />;
  if (path === "login") return <LoginPage />;
  if (path === "policy") return <PolicyPage />;
  if (path === "register") return <RegisterPage />;
  if (path === "search") return <SearchPage searchParams={resolvedSearchParams} />;
  if (path === "shop") return <ShopPage searchParams={Promise.resolve(resolvedSearchParams)} />;
  if (path === "terms") return <TermsPage />;
  if (path === "user-dashboard") return <UserDashboardPage />;
  if (path === "wishlist") return <WishlistPage />;

  if (slug[0] === "product-details" && slug[1]) {
    return <ProductDetailsPage params={Promise.resolve({ id: slug[1] })} />;
  }

  if (slug[0] === "order" && slug[1]) {
    return <OrderPage params={Promise.resolve({ id: slug[1] })} />;
  }

  notFound();
}
