import type { Locale } from "./types";

const copy = {
  fa: {
    welcome: (name: string) => `به ${name} خوش آمدید`, introduction: "برای مشاهده سفارش‌ها و مدیریت علاقه‌مندی‌ها وارد حساب خود شوید.",
    signIn: "ورود | ثبت‌نام", viewCart: "مشاهده سبد خرید", guide: "راهنمای خرید", accountSubtitle: "مشاهده و مدیریت حساب کاربری",
    overview: "نمای کلی حساب", orders: "سفارش‌های من", addresses: "آدرس‌های من", security: "اطلاعات و امنیت حساب", logout: "خروج از حساب کاربری", wishlistTitle: "علاقه‌مندی‌های شما",
    count: (count: string) => `${count} کالا`, helper: "برای مشاهده همه محصولات ذخیره‌شده، وارد لیست شوید.", viewWishlist: "مشاهده لیست علاقه‌مندی‌ها",
    emptyTitle: "هنوز محصولی ذخیره نکرده‌اید", emptyBody: "با انتخاب قلب روی محصولات، آن‌ها را اینجا ببینید.", browse: "مشاهده محصولات",
    add: "افزودن به سبد", loading: "در حال دریافت اطلاعات…", error: "دریافت قیمت و موجودی انجام نشد.", retry: "تلاش مجدد",
    unavailable: "این محصول در دسترس نیست", outOfStock: "ناموجود", remove: (name: string) => `حذف ${name} از علاقه‌مندی‌ها`,
  },
  en: {
    welcome: (name: string) => `Welcome to ${name}`, introduction: "Sign in to view orders and manage your wishlist.",
    signIn: "Sign in | Register", viewCart: "View shopping cart", guide: "Shopping guide", accountSubtitle: "View and manage your account",
    overview: "Account overview", orders: "My orders", addresses: "My addresses", security: "Account information and security", logout: "Sign out", wishlistTitle: "Your wishlist",
    count: (count: string) => `${count} items`, helper: "Open your wishlist to view all saved products.", viewWishlist: "View wishlist",
    emptyTitle: "You haven't saved any products yet", emptyBody: "Select the heart on products to see them here.", browse: "Browse products",
    add: "Add to cart", loading: "Loading…", error: "Prices and availability could not be loaded.", retry: "Try again",
    unavailable: "This product is unavailable", outOfStock: "Out of stock", remove: (name: string) => `Remove ${name} from wishlist`,
  },
};

/** Penpot dropdown copy, centralized alongside the existing localized storefront dictionaries. */
export function getHeaderDropdownCopy(locale: Locale) { return copy[locale]; }
