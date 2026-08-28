import type { MegaMenuCategory, ProductSummary } from "./types";

/**
 * Mock catalog for the storefront UI, mirroring the approved Penpot designs
 * (home product rows, category circles and mega-menu structure).
 * When the ASP.NET Core API becomes available this module is replaced by
 * typed API calls without changing the component props.
 */

/** Bag artwork colour variants used across cards and order lines. */
export type ArtworkColor = "jade" | "clay" | "steel";

export const bagProducts: ProductSummary[] = [
  {
    id: "vd-101",
    slug: "artin-backpack",
    name: "کوله‌پشتی آرتین",
    nameEn: "Artin backpack",
    meta: "ضدآب · لپ‌تاپ ۱۵ اینچ",
    metaEn: "Water-repellent · 15\" laptop",
    price: 1890000,
    badge: { key: "free_shipping", label: "ارسال رایگان", labelEn: "Free shipping" },
  },
  {
    id: "vd-102",
    slug: "mahtab-handbag",
    name: "کیف دستی مهتاب",
    nameEn: "Mahtab handbag",
    meta: "چرم مصنوعی · سرعت روزمره",
    metaEn: "Vegan leather · everyday carry",
    price: 1450000,
    badge: null,
  },
  {
    id: "vd-103",
    slug: "nova-shoulder",
    name: "کیف دوشی نوا",
    nameEn: "Nova shoulder bag",
    meta: "سبک · بند قابل تنظیم",
    metaEn: "Lightweight · adjustable strap",
    price: 980000,
    badge: null,
  },
  {
    id: "vd-104",
    slug: "reha-student",
    name: "کوله دانشجویی رها",
    nameEn: "Reha student backpack",
    meta: "مخصوص کتاب · جیب زیاد",
    metaEn: "Book-friendly · extra pockets",
    price: 1240000,
    badge: { key: "free_shipping", label: "ارسال رایگان", labelEn: "Free shipping" },
  },
  {
    id: "vd-105",
    slug: "parsa-laptop",
    name: "کیف لپ‌تاپ پارسا",
    nameEn: "Parsa laptop bag",
    meta: "محفظه ضربه‌گیر · اداری",
    metaEn: "Padded compartment · office",
    price: 1620000,
    badge: null,
  },
  {
    id: "vd-106",
    slug: "rojan-waist",
    name: "کیف کمری روژان",
    nameEn: "Rojan waist bag",
    meta: "جنگلی · کمپینگ",
    metaEn: "Outdoor · hiking ready",
    price: 640000,
    badge: null,
  },
  {
    id: "vd-107",
    slug: "sabaa-travel",
    name: "کیف سفر صبا",
    nameEn: "Sabaa travel bag",
    meta: "چمدان نرم · چرخ‌دار",
    metaEn: "Soft case · trolley wheels",
    price: 2980000,
    badge: { key: "free_shipping", label: "ارسال رایگان", labelEn: "Free shipping" },
  },
  {
    id: "vd-108",
    slug: "kian-sport",
    name: "کیف ورزشی کیان",
    nameEn: "Kian sport duffel",
    meta: "خوش‌بو · محفظه کفش",
    metaEn: "Ventilated · shoe pocket",
    price: 890000,
    badge: null,
  },
];

/** Home rows exactly as composed in the Penpot desktop frame. */
export const popularProductIds = ["vd-101", "vd-102", "vd-103", "vd-104", "vd-105"];
export const newestProductIds = ["vd-106", "vd-103", "vd-108", "vd-102", "vd-107"];

export const categoryCircles = [
  { key: "backpack", label: "کوله‌پشتی", labelEn: "Backpacks", href: "/shop" },
  { key: "handbag", label: "کیف دستی", labelEn: "Handbags", href: "/shop" },
  { key: "shoulder", label: "کیف دوشی", labelEn: "Shoulder bags", href: "/shop" },
  { key: "office", label: "اداری و لپ‌تاپ", labelEn: "Office & laptop", href: "/shop" },
  { key: "sport", label: "ورزشی", labelEn: "Sport", href: "/shop" },
  { key: "travel", label: "سفر و چمدان", labelEn: "Travel & luggage", href: "/shop" },
  { key: "kids", label: "کیف کودک", labelEn: "Kids bags", href: "/shop" },
  { key: "accessory", label: "اکسسوری", labelEn: "Accessories", href: "/shop" },
];

/**
 * Mega-menu model: eight categories with grouped subcategory links,
 * following the two-panel Penpot component.
 */
export const megaMenuCategories: MegaMenuCategory[] = [
  {
    key: "backpack",
    label: "کوله‌پشتی",
    labelEn: "Backpacks",
    href: "/shop",
    groups: [
      {
        title: "کاربرد",
        titleEn: "Use",
        items: [
          { label: "شهری و روزمره", labelEn: "Urban & daily", href: "/shop" },
          { label: "دانشجویی", labelEn: "Student", href: "/shop" },
          { label: "لپ‌تاپ", labelEn: "Laptop", href: "/shop" },
          { label: "کوهنوردی و طبیعت", labelEn: "Hiking & nature", href: "/shop" },
        ],
      },
      {
        title: "ویژگی",
        titleEn: "Features",
        items: [
          { label: "ضدآب", labelEn: "Water-repellent", href: "/shop" },
          { label: "طبی و ارگونومیک", labelEn: "Ergonomic", href: "/shop" },
          { label: "سبک‌وزن", labelEn: "Lightweight", href: "/shop" },
          { label: "چندکاره", labelEn: "Multipurpose", href: "/shop" },
        ],
      },
      {
        title: "محدوده قیمت",
        titleEn: "Price range",
        items: [
          { label: "تا ۱ میلیون", labelEn: "Under 1M Toman", href: "/shop" },
          { label: "۱ تا ۲ میلیون", labelEn: "1–2M Toman", href: "/shop" },
          { label: "بالاتر از ۲ میلیون", labelEn: "Above 2M Toman", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "handbag",
    label: "کیف دستی",
    labelEn: "Handbags",
    href: "/shop",
    groups: [
      {
        title: "مناسبت",
        titleEn: "Occasion",
        items: [
          { label: "روزمره", labelEn: "Everyday", href: "/shop" },
          { label: "مهمانی", labelEn: "Evening", href: "/shop" },
          { label: "اداری", labelEn: "Office", href: "/shop" },
        ],
      },
      {
        title: "جنس",
        titleEn: "Material",
        items: [
          { label: "چرم طبیعی", labelEn: "Real leather", href: "/shop" },
          { label: "چرم مصنوعی", labelEn: "Vegan leather", href: "/shop" },
          { label: "پارچه", labelEn: "Fabric", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "shoulder",
    label: "کیف دوشی",
    labelEn: "Shoulder bags",
    href: "/shop",
    groups: [
      {
        title: "سبک",
        titleEn: "Style",
        items: [
          { label: "مینیمال", labelEn: "Minimal", href: "/shop" },
          { label: "اسپرت", labelEn: "Casual", href: "/shop" },
          { label: "کلاسیک", labelEn: "Classic", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "office",
    label: "کیف اداری و لپ‌تاپ",
    labelEn: "Office & laptop bags",
    href: "/shop",
    groups: [
      {
        title: "سایز لپ‌تاپ",
        titleEn: "Laptop size",
        items: [
          { label: "۱۳ اینچ", labelEn: "13 inch", href: "/shop" },
          { label: "۱۵ اینچ", labelEn: "15 inch", href: "/shop" },
          { label: "۱۷ اینچ", labelEn: "17 inch", href: "/shop" },
        ],
      },
      {
        title: "نوع",
        titleEn: "Type",
        items: [
          { label: "کیف دسته‌دار", labelEn: "Briefcase", href: "/shop" },
          { label: "کیف دوشی", labelEn: "Messenger", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "sport",
    label: "کیف ورزشی",
    labelEn: "Sport bags",
    href: "/shop",
    groups: [
      {
        title: "رشته",
        titleEn: "Activity",
        items: [
          { label: "باشگاه", labelEn: "Gym", href: "/shop" },
          { label: "شنا", labelEn: "Swimming", href: "/shop" },
          { label: " فوتبال", labelEn: "Football", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "travel",
    label: "چمدان و سفر",
    labelEn: "Travel & luggage",
    href: "/shop",
    groups: [
      {
        title: "نوع",
        titleEn: "Type",
        items: [
          { label: "چمدان چرخ‌دار", labelEn: "Trolley", href: "/shop" },
          { label: "ساک سفر", labelEn: "Duffel", href: "/shop" },
          { label: "کیف کمری سفر", labelEn: "Travel pouch", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "kids",
    label: "کیف کودک",
    labelEn: "Kids bags",
    href: "/shop",
    groups: [
      {
        title: "سن",
        titleEn: "Age",
        items: [
          { label: "مهدکودک", labelEn: "Kindergarten", href: "/shop" },
          { label: "مدرسه", labelEn: "School", href: "/shop" },
        ],
      },
    ],
  },
  {
    key: "accessory",
    label: "اکسسوری کیف",
    labelEn: "Bag accessories",
    href: "/shop",
    groups: [
      {
        title: "دسته",
        titleEn: "Category",
        items: [
          { label: "آویز و کلید", labelEn: "Charms & keys", href: "/shop" },
          { label: "نگهداری و مراقبت", labelEn: "Care & storage", href: "/shop" },
        ],
      },
    ],
  },
];
