import { bagProducts } from "./catalog";
import type {
  AccountProfile,
  AddressBookEntry,
  OrderDetail,
  OrderSummary,
  ProductSummary,
  ReturnRequestSummary,
  TransactionRowModel,
} from "./types";

/**
 * Mock account data mirroring the approved Penpot account screens
 * (pages Vendora · 05 – 10). Display-only; no server calls.
 */

export const mockProfile: AccountProfile = {
  fullName: "کاربر وندورا",
  fullNameEn: "Vendora user",
  firstName: "",
  lastName: "",
  email: "user@vendora.example",
  phone: "09121234567",
  memberBadge: "عضو فعال",
  memberBadgeEn: "Active member",
  clubPoints: 240,
  clubPointsToNext: 60,
};

export const mockOrders: OrderSummary[] = [
  {
    id: "1048",
    code: "VD-1048",
    status: "processing",
    itemCount: 3,
    total: 2980000,
    dateLabel: "۲۴ مرداد ۱۴۰۵",
    dateLabelEn: "Aug 15, 2026",
  },
  {
    id: "1032",
    code: "VD-1032",
    status: "shipped",
    itemCount: 1,
    total: 1490000,
    dateLabel: "۲۴ مرداد ۱۴۰۵",
    dateLabelEn: "Aug 15, 2026",
  },
  {
    id: "986",
    code: "VD-0986",
    status: "delivered",
    itemCount: 2,
    total: 980000,
    dateLabel: "۲۴ مرداد ۱۴۰۵",
    dateLabelEn: "Aug 15, 2026",
  },
  {
    id: "912",
    code: "VD-0912",
    status: "cancelled",
    itemCount: 1,
    total: 790000,
    dateLabel: "۱۸ تیر ۱۴۰۵",
    dateLabelEn: "Jul 9, 2026",
  },
];

export const mockOrderDetail: OrderDetail = {
  id: "1048",
  code: "VD-1048",
  status: "processing",
  itemCount: 3,
  total: 2980000,
  dateLabel: "۲۴ مرداد ۱۴۰۵",
  dateLabelEn: "Aug 15, 2026",
  placedAtLabel: "۲۴ مرداد ۱۴۰۵",
  placedAtLabelEn: "Aug 15, 2026",
  progressStep: 2,
  paymentMethod: "پرداخت آنلاین",
  shippingMethod: "پست پیشتاز",
  items: [
    { id: "it-1", name: "کوله‌پشتی آرتین", quantity: 1, price: 1890000, artworkColor: "jade" },
    { id: "it-2", name: "کیف دوشی نوا", quantity: 1, price: 980000, artworkColor: "clay" },
    { id: "it-3", name: "کاور باران", quantity: 1, price: 110000, artworkColor: "steel" },
  ],
  itemsSubtotal: 2980000,
  shippingCost: 0,
  shippingAddress: {
    title: "آدرس منزل",
    address: "استان، شهر، خیابان نمونه، پلاک و واحد",
    recipient: "کاربر وندورا",
  },
};

export const mockAddresses: AddressBookEntry[] = [
  {
    id: "addr-home",
    title: "آدرس منزل",
    isDefault: true,
    address: "استان، شهر، خیابان نمونه، پلاک — کد پستی",
    recipient: "کاربر وندورا",
    phoneMasked: "۰۹•••••••••",
  },
  {
    id: "addr-work",
    title: "محل کار",
    isDefault: true,
    address: "استان، شهر، بلوار نمونه، ساختمان اداری — کد پستی",
    recipient: "کاربر وندورا",
    phoneMasked: "۰۹•••••••••",
  },
];

export const mockReturns: ReturnRequestSummary[] = [
  {
    id: "r-1024",
    code: "VD-R-1024",
    status: "under_review",
    orderCode: "VD-140412-1024",
    item: "کوله‌پشتی وندورا مدل Urban 20L",
    itemEn: "Vendora Urban 20L backpack",
    reason: "کالا با توضیحات سایت مطابقت ندارد",
    reasonEn: "Item does not match the website description",
    submittedLabel: "۱۴ مرداد ۱۴۰۵",
    submittedLabelEn: "Aug 5, 2026",
  },
  {
    id: "r-987",
    code: "VD-R-0987",
    status: "approved",
    orderCode: "VD-140402-0987",
    item: "کیف دوشی نوا",
    itemEn: "Nova shoulder bag",
    reason: "کالا معیوب یا آسیب‌دیده است",
    reasonEn: "Item is defective or damaged",
    submittedLabel: "۰۲ مرداد ۱۴۰۵",
    submittedLabelEn: "Jul 24, 2026",
  },
];

export const returnNewDefaults = {
  orderCode: "VD-140412-1024",
  orderDateLabel: "۱۴۰۵/۰۵/۱۰",
  orderDateLabelEn: "Aug 1, 2026",
  productName: "کوله‌پشتی وندورا مدل Urban",
  sku: "URBAN-20-JADE",
  quantity: "۱",
};

export const accountBalance = 2450000;

export const mockTransactions: TransactionRowModel[] = [
  {
    id: "t-494",
    description: "بابت سفارش VD-۱۰۴۸",
    amount: 2980000,
    direction: "out",
    dateLabel: "۲۴ مرداد ۱۴۰۵",
    dateLabelEn: "Aug 15, 2026",
  },
  {
    id: "t-594",
    description: "بابت سفارش VD-۱۰۳۲",
    amount: 1490000,
    direction: "out",
    dateLabel: "۲۴ مرداد ۱۴۰۵",
    dateLabelEn: "Aug 15, 2026",
  },
  {
    id: "t-694",
    description: "بازگشت وجه سفارش VD-۰۹۱۲",
    amount: 790000,
    direction: "in",
    dateLabel: "۲۰ تیر ۱۴۰۵",
    dateLabelEn: "Jul 11, 2026",
  },
  {
    id: "t-794",
    description: "افزایش اعتبار حساب",
    amount: 1000000,
    direction: "in",
    dateLabel: "۱۲ تیر ۱۴۰۵",
    dateLabelEn: "Jul 3, 2026",
  },
];

/** Wishlist entries shown on the designed account wishlist page. */
export const mockWishlist: ProductSummary[] = [
  bagProductById("vd-101"),
  bagProductById("vd-105"),
  bagProductById("vd-107"),
  bagProductById("vd-108"),
].filter((p): p is ProductSummary => Boolean(p));

/** Recommendation strip under the wishlist grid. */
export const wishlistRecommendations: ProductSummary[] = [
  bagProductById("vd-102"),
  bagProductById("vd-103"),
  bagProductById("vd-106"),
].filter((p): p is ProductSummary => Boolean(p));

function bagProductById(id: string): ProductSummary | undefined {
  return bagProducts.find((p) => p.id === id);
}
