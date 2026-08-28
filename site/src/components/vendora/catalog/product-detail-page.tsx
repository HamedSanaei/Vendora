"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Header from "@/layout/header";
import Footer from "@/layout/footer";
import { BagArtwork } from "@/components/vendora/product/bag-artwork";
import { CartIcon, CheckIcon, ChevronIcon, HeartIcon, QualityIcon, ReturnIcon, SupportIcon, TruckIcon } from "@/components/vendora/icons";
import { QuantityStepper } from "@/components/vendora/cart/cart-components";
import { bagProducts } from "@/lib/vendora/catalog";
import { formatNumber, formatPrice } from "@/lib/vendora/format";
import { getDict } from "@/lib/vendora/i18n";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import type { Locale, ProductSummary } from "@/lib/vendora/types";
import { useGetProductQuery, useGetShowingProductsQuery } from "@/redux/features/productApi";
import { add_cart_product, quantityDecrement, quantityIncrement } from "@/redux/features/cartSlice";
import { add_to_wishlist } from "@/redux/features/wishlist-slice";
import { CatalogProductCard } from "./catalog-product-card";
import { getCatalogCopy } from "./catalog-copy";
import type { CatalogProductModel, StoreProduct } from "./catalog-types";
import { isVendoraProductImage, toCatalogProduct } from "./catalog-types";

/** Full product page with reusable gallery, information, purchase and specification sections. */
export function ProductDetailPage({ id }: { id: string }) {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const t = getCatalogCopy(locale);
  const dispatch = useDispatch();
  const localSummary = bagProducts.find((item) => item.slug === id || item.id === id);
  const { data, isLoading, isError } = useGetProductQuery(id, { skip: Boolean(localSummary) });
  const { data: catalogData } = useGetShowingProductsQuery(undefined);
  const cartProducts = useSelector((state: { cart: { cart_products: Array<StoreProduct & { orderQuantity: number }> } }) => state.cart.cart_products);
  const wishlist = useSelector((state: { wishlist: { wishlist: StoreProduct[] } }) => state.wishlist.wishlist);
  const sourceProduct = useMemo<StoreProduct | null>(() => localSummary ? fromSummary(localSummary, locale) : data ?? null, [data, localSummary, locale]);
  const product = useMemo<CatalogProductModel | null>(() => sourceProduct ? toCatalogProduct(sourceProduct) : null, [sourceProduct]);
  const related = useMemo<CatalogProductModel[]>(() => (catalogData?.products ?? []).filter((item: StoreProduct) => item._id !== id).slice(0, 4).map(toCatalogProduct), [catalogData, id]);

  if (isLoading && !localSummary) return <ProductPageShell><ProductDetailSkeleton /></ProductPageShell>;
  if ((isError && !localSummary) || !product) return <ProductPageShell><div className="vd-container py-24 text-center text-base font-bold text-vd-muted">{t.productNotFound}</div></ProductPageShell>;

  const favorited = wishlist.some((item) => item._id === product.id);
  const productCartItem = cartProducts.find((item) => item._id === product.id);
  return (
    <ProductPageShell>
      <main className="vd-container pb-4 pt-5 md:pt-8 lg:pt-10">
        <ProductBreadcrumb locale={locale} title={product.title} />
        <section className="vd-product-hero mt-5 grid gap-5 lg:mt-7 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,.86fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.9fr)_340px] xl:gap-7">
          <ProductGallery product={product} locale={locale} favorited={favorited} onFavorite={() => dispatch(add_to_wishlist(product.source))} />
          <ProductInformation product={product} locale={locale} />
          <PurchasePanel product={product} locale={locale} quantity={productCartItem?.orderQuantity ?? 0} onIncrement={() => dispatch(productCartItem ? quantityIncrement(product.source) : add_cart_product(product.source))} onDecrement={() => dispatch(quantityDecrement(product.source))} onAdd={() => dispatch(add_cart_product(product.source))} />
        </section>

        <CommerceBenefits locale={locale} />
        <ProductContent product={product} locale={locale} />

        {related.length > 0 ? (
          <section className="mt-10 md:mt-14 lg:mt-16">
            <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-ink md:text-2xl">{t.related}</h2><Link href={withLocalePath("/shop", locale)} className="vd-focus rounded-sm text-xs font-bold text-jade md:text-sm">{t.viewAll}</Link></div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:gap-5">
              {related.map((item, index) => {
                const cartItem = cartProducts.find((entry) => entry._id === item.id);
                return (
                  <div key={item.id} className="min-h-[382px] md:min-h-[410px]">
                    <CatalogProductCard
                      product={item}
                      locale={locale}
                      compact
                      artworkColor={index % 3 === 0 ? "jade" : index % 3 === 1 ? "clay" : "steel"}
                      cartQuantity={cartItem?.orderQuantity ?? 0}
                      onIncreaseCart={(selected) => dispatch(cartItem ? quantityIncrement(selected.source) : add_cart_product(selected.source))}
                      onDecreaseCart={(selected) => dispatch(quantityDecrement(selected.source))}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </ProductPageShell>
  );
}

/** Provides the isolated Vendora storefront chrome around product states. */
function ProductPageShell({ children }: { children: React.ReactNode }) {
  return <div className="vd-root min-h-screen bg-white"><Header />{children}<Footer /></div>;
}

/** Locale-aware breadcrumb shared by every product detail. */
function ProductBreadcrumb({ locale, title }: { locale: Locale; title: string }) {
  const t = getCatalogCopy(locale);
  return <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-xs text-vd-muted"><Link href={withLocalePath("/", locale)} className="vd-focus shrink-0 rounded-sm hover:text-jade">{t.home}</Link><ChevronIcon size={14} /><Link href={withLocalePath("/shop", locale)} className="vd-focus shrink-0 rounded-sm hover:text-jade">{t.products}</Link><ChevronIcon size={14} /><span className="truncate font-semibold text-ink">{title}</span></nav>;
}

/** Responsive media gallery with selectable thumbnails and the preserved wishlist action. */
function ProductGallery({ product, locale, favorited, onFavorite }: { product: CatalogProductModel; locale: Locale; favorited: boolean; onFavorite: () => void }) {
  const t = getCatalogCopy(locale);
  const gallery = useMemo(() => {
    const approvedImages = product.gallery.filter(isVendoraProductImage);
    return approvedImages.length > 0 ? approvedImages : [""];
  }, [product.gallery]);
  const [activeImage, setActiveImage] = useState(gallery[0]);
  useEffect(() => setActiveImage(gallery[0]), [gallery]);
  return (
    <div className="vd-product-hero__gallery min-w-0">
      <div className="vd-product-hero__media relative aspect-[1.08/1] overflow-hidden rounded-[22px] border border-vd-line bg-surface-soft md:aspect-[1.18/1] lg:aspect-square">
        <button type="button" onClick={onFavorite} aria-label={favorited ? t.removeFromWishlist : t.addToWishlist} aria-pressed={favorited} className={`vd-focus absolute start-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-vd-line shadow-sm ${favorited ? "bg-vd-danger-tint text-vd-danger" : "bg-white/95 text-ink hover:text-vd-danger"}`}><HeartIcon size={20} filled={favorited} /></button>
        {activeImage ? <Image src={activeImage} alt={product.title} fill priority unoptimized={activeImage.includes("/uploads/")} sizes="(max-width: 1023px) 92vw, 42vw" className="object-contain" /> : <div className="flex h-full items-center justify-center"><BagArtwork color="jade" className="h-[58%] w-auto" /></div>}
      </div>
      {gallery.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{gallery.map((image, index) => <button key={image} type="button" onClick={() => setActiveImage(image)} aria-label={`${product.title} ${index + 1}`} className={`vd-focus relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-control border bg-surface-soft ${activeImage === image ? "border-jade ring-1 ring-jade" : "border-vd-line"}`}><Image src={image} alt="" fill unoptimized={image.includes("/uploads/")} sizes="72px" className="object-contain" /></button>)}</div> : null}
    </div>
  );
}

type ProductColorOption = { value: string; label: string; hex: string };

const PRODUCT_COLOR_META: Record<string, { fa: string; en: string; hex: string }> = {
  jade: { fa: "سبز یشمی", en: "Jade green", hex: "#006b4f" },
  green: { fa: "سبز", en: "Green", hex: "#16855b" },
  black: { fa: "مشکی", en: "Black", hex: "#0b0b0b" },
  white: { fa: "سفید", en: "White", hex: "#ffffff" },
  brown: { fa: "قهوه‌ای", en: "Brown", hex: "#8b6f47" },
  clay: { fa: "شتری", en: "Camel", hex: "#9a7b4f" },
  blue: { fa: "آبی", en: "Blue", hex: "#3567a5" },
  steel: { fa: "خاکستری", en: "Grey", hex: "#64748b" },
};

/** Converts a product color slug into accessible localized swatch metadata. */
function toProductColorOption(value: string, locale: Locale): ProductColorOption {
  const normalized = value.trim().toLowerCase();
  const metadata = PRODUCT_COLOR_META[normalized];
  return { value, label: metadata ? metadata[locale] : value, hex: metadata?.hex ?? "#6b7280" };
}

/** Produces four compact feature rows without repeating long product description text. */
function getPrimaryFeatures(product: CatalogProductModel, fallback: string): string[] {
  const values = [...product.tags, product.category, product.brand, fallback]
    .map((value) => value.trim())
    .filter((value, index, items) => Boolean(value) && items.indexOf(value) === index);
  return values.slice(0, 4);
}

/** Five-star rating summary matching the approved Product / Information component. */
function ProductRating({ locale, rating, reviewCount }: { locale: Locale; rating: number; reviewCount: number }) {
  const t = getCatalogCopy(locale);
  const roundedRating = Math.round(rating);
  return (
    <div className="vd-product-information__rating" aria-label={`${formatNumber(rating, locale)} ${t.ratingOutOf}`}>
      <span className="flex items-center gap-1 text-[#f59e0b]" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <svg key={index} width="20" height="20" viewBox="0 0 24 24" fill={index < roundedRating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3.4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.3l-5.1 2.7 1-5.6-4.1-4 5.7-.8L12 3.4Z" />
          </svg>
        ))}
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-ink">{formatNumber(rating, locale)} {t.ratingOutOf} · {formatNumber(reviewCount, locale)} {t.reviewLabel}</span>
    </div>
  );
}

/** Product identity, rating, color and primary-feature card aligned with Penpot. */
function ProductInformation({ product, locale }: { product: CatalogProductModel; locale: Locale }) {
  const t = getCatalogCopy(locale);
  const colorOptions = useMemo(() => (product.colors.length > 0 ? product.colors : ["jade", "brown", "black", "blue"]).map((color) => toProductColorOption(color, locale)), [locale, product.colors]);
  const features = useMemo(() => getPrimaryFeatures(product, t.original), [product, t.original]);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]?.value ?? "");
  useEffect(() => setSelectedColor(colorOptions[0]?.value ?? ""), [colorOptions]);
  const selectedColorOption = colorOptions.find((color) => color.value === selectedColor) ?? colorOptions[0];

  return (
    <section className="vd-product-hero__information min-w-0 rounded-[18px] border border-vd-line bg-white" aria-labelledby="product-information-title">
      <p className="vd-product-information__eyebrow" dir="ltr">{t.originalEyebrow}</p>
      <h1 id="product-information-title" className="vd-product-hero__title vd-product-information__title">{product.title}</h1>
      <p className="vd-product-information__subtitle" dir="ltr">{product.category}</p>
      <hr className="vd-product-information__divider border-vd-line" />
      <ProductRating locale={locale} rating={product.rating} reviewCount={product.reviewCount} />

      <div className="vd-product-information__colors">
        <p className="vd-product-information__color-label">{t.selectedColor}: <strong>{selectedColorOption?.label ?? "—"}</strong></p>
        <div className="vd-product-information__swatches">
          {colorOptions.map((color) => {
            const selected = color.value === selectedColor;
            return (
              <button key={color.value} type="button" onClick={() => setSelectedColor(color.value)} aria-label={`${t.selectedColor}: ${color.label}`} aria-pressed={selected} className={`vd-focus flex h-11 w-11 items-center justify-center rounded-full border bg-white ${selected ? "border-jade ring-2 ring-jade ring-offset-2" : "border-vd-line hover:border-jade"}`}>
                <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="vd-product-information__features">
        <h2 className="vd-product-information__features-title">{t.primaryFeatures}</h2>
        <ul className="vd-product-information__feature-list">
          {features.map((feature, index) => (
            <li key={`${feature}-${index}`} className="vd-product-information__feature">
              <CheckIcon size={18} className="shrink-0 text-jade" />
              <span className="vd-product-information__feature-text">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Purchase card driven exclusively by the persisted shared cart quantity. */
function PurchasePanel({ product, locale, quantity, onIncrement, onDecrement, onAdd }: { product: CatalogProductModel; locale: Locale; quantity: number; onIncrement: () => void; onDecrement: () => void; onAdd: () => void }) {
  const t = getCatalogCopy(locale);
  const cartT = getDict(locale).cart;
  const isInCart = quantity > 0;
  const statusLabel = isInCart ? cartT.inCart : product.stock > 0 ? t.available : t.unavailable;

  return (
    <aside className="vd-product-hero__purchase rounded-[18px] border border-vd-line bg-surface-soft p-5 shadow-[0_16px_46px_-36px_rgba(0,77,58,.7)] lg:sticky lg:top-4 lg:p-6">
      <div className={`flex items-center gap-2 text-xs font-bold ${product.stock > 0 || isInCart ? "text-jade" : "text-vd-danger"}`}>
        {isInCart ? <CheckIcon size={16} /> : <span className={`h-2.5 w-2.5 rounded-full ${product.stock > 0 ? "bg-jade-light" : "bg-vd-danger"}`} />}
        {statusLabel}
      </div>
      <div className="mt-5 border-t border-vd-line pt-5">{product.oldPrice ? <p className="text-xs text-vd-muted line-through">{formatPrice(product.oldPrice, locale)}</p> : null}<p className="text-[24px] font-extrabold text-ink">{formatPrice(product.price, locale)}</p></div>
      {isInCart ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="text-xs font-bold text-vd-muted">{t.quantity}</span>
          <QuantityStepper locale={locale} quantity={quantity} max={product.stock} size="regular" onDecrease={onDecrement} onIncrease={onIncrement} />
        </div>
      ) : null}
      {isInCart ? (
        <Link href={withLocalePath("/cart", locale)} className="vd-focus mt-5 flex h-12 w-full items-center justify-center rounded-control border border-jade bg-white px-4 text-sm font-extrabold text-jade hover:bg-jade-tint">{cartT.viewCart}</Link>
      ) : (
        <button type="button" onClick={onAdd} disabled={product.stock < 1} className="vd-focus mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-jade px-4 text-sm font-extrabold text-white hover:bg-jade-dark disabled:bg-vd-line disabled:text-vd-muted"><CartIcon size={20} />{t.addToCart}</button>
      )}
      <div className="vd-product-hero__warranty mt-5 flex items-start gap-2 border-t border-vd-line pt-4 text-[11px] leading-6 text-vd-muted"><QualityIcon size={18} className="mt-1 shrink-0 text-jade" /><span>{t.warranty}</span></div>
    </aside>
  );
}

/** Trust benefits positioned directly below the commerce hero. */
function CommerceBenefits({ locale }: { locale: Locale }) {
  const t = getCatalogCopy(locale);
  const items = [{ Icon: TruckIcon, label: t.delivery }, { Icon: QualityIcon, label: t.original }, { Icon: SupportIcon, label: t.support }, { Icon: ReturnIcon, label: t.returnable }];
  return <section aria-label={t.securePurchase} className="mt-6 grid grid-cols-2 gap-2 rounded-[18px] border border-vd-line p-3 md:mt-8 md:grid-cols-4 md:gap-0 md:p-5">{items.map(({ Icon, label }, index) => <div key={label} className={`flex items-center gap-3 rounded-control p-3 ${index > 0 ? "md:border-s md:border-vd-line" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jade-tint text-jade"><Icon size={20} /></span><span className="text-xs font-bold text-ink md:text-sm">{label}</span></div>)}</section>;
}

/** Tabbed description and specification surface adapted from the Exo content model. */
function ProductContent({ product, locale }: { product: CatalogProductModel; locale: Locale }) {
  const t = getCatalogCopy(locale);
  const [activeTab, setActiveTab] = useState<"description" | "specifications" | "reviews">("specifications");
  const rows = [[t.productCode, product.sku], [t.categories, product.category], [t.brands, product.brand], [t.colors, product.colors.join("، ") || "—"], [t.availability, product.stock > 0 ? t.available : t.unavailable], [locale === "fa" ? "تعداد موجود" : "Stock count", formatNumber(product.stock, locale)]];
  const tabs = [{ key: "specifications" as const, label: t.specifications }, { key: "description" as const, label: t.description }, { key: "reviews" as const, label: t.reviews }];
  return (
    <section className="mt-10 md:mt-14 lg:mt-16">
      <div className="flex gap-2 overflow-x-auto border-b border-vd-line">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`vd-focus h-12 shrink-0 border-b-2 px-4 text-sm font-extrabold ${activeTab === tab.key ? "border-jade text-jade" : "border-transparent text-vd-muted"}`}>{tab.label}</button>)}</div>
      <div className="py-6 md:py-8">{activeTab === "specifications" ? <dl className="overflow-hidden rounded-[18px] border border-vd-line">{rows.map(([label, value], index) => <div key={label} className={`grid min-h-14 grid-cols-[42%_58%] items-center ${index > 0 ? "border-t border-vd-line" : ""}`}><dt className="h-full bg-surface-soft px-4 py-4 text-xs font-bold text-vd-muted md:px-6 md:text-sm">{label}</dt><dd className="m-0 px-4 py-4 text-xs font-semibold text-ink md:px-6 md:text-sm">{value}</dd></div>)}</dl> : null}{activeTab === "description" ? <div className="max-w-4xl"><h2 className="text-xl font-extrabold text-ink">{product.title}</h2><p className="mt-4 text-sm leading-8 text-vd-muted md:text-base">{product.description || (locale === "fa" ? "این محصول با تمرکز بر دوام، استفاده روزمره و جزئیات کاربردی در کارگاه وندورا تولید شده است." : "This product is made with a focus on durability, everyday use and practical details.")}</p></div> : null}{activeTab === "reviews" ? <div className="rounded-[18px] border border-dashed border-vd-line bg-surface-soft p-10 text-center text-sm font-semibold text-vd-muted">{locale === "fa" ? "هنوز دیدگاهی برای این محصول ثبت نشده است." : "No reviews have been submitted yet."}</div> : null}</div>
    </section>
  );
}

/** Converts the approved homepage mock into the API-compatible product contract. */
function fromSummary(summary: ProductSummary, locale: Locale): StoreProduct {
  return { _id: summary.slug, title: locale === "fa" ? summary.name : summary.nameEn, description: locale === "fa" ? summary.meta : summary.metaEn, originalPrice: summary.price, quantity: 12, sku: summary.id, parent: locale === "fa" ? "کیف‌های وندورا" : "Vendora bags", brand: { name: "Vendora Studio" }, tags: [locale === "fa" ? summary.meta : summary.metaEn], colors: ["jade"] };
}

/** Skeleton matching the three-column product hero. */
function ProductDetailSkeleton() {
  return <main className="vd-container py-10"><div className="vd-product-hero grid animate-pulse gap-5 lg:grid-cols-[1.12fr_.86fr_320px]"><div className="vd-product-hero__gallery rounded-[22px] bg-surface-soft"><div className="vd-product-hero__media aspect-square" /></div><div className="vd-product-hero__information h-[420px] rounded-[18px] bg-surface-soft" /><div className="vd-product-hero__purchase h-[360px] rounded-[18px] bg-surface-soft" /></div></main>;
}
