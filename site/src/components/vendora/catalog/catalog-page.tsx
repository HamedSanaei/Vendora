"use client";

import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Header from "@/layout/header";
import Footer from "@/layout/footer";
import { ChevronIcon, CloseIcon, MenuIcon } from "@/components/vendora/icons";
import { categoryCircles } from "@/lib/vendora/catalog";
import { formatNumber } from "@/lib/vendora/format";
import { getLocaleFromPathname, toTemplateSlug, withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useGetShowingProductsQuery } from "@/redux/features/productApi";
import { add_cart_product, quantityDecrement, quantityIncrement } from "@/redux/features/cartSlice";
import { add_to_wishlist } from "@/redux/features/wishlist-slice";
import { CatalogProductCard } from "./catalog-product-card";
import { getCatalogCopy } from "./catalog-copy";
import type { CatalogProductModel, StoreProduct } from "./catalog-types";
import { toCatalogProduct } from "./catalog-types";

interface CatalogPageProps {
  Category?: string;
  category?: string;
  brand?: string;
  priceMin?: string;
  max?: string;
  priceMax?: string;
  color?: string;
}

interface FilterPanelProps {
  locale: Locale;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedColors: string[];
  inStockOnly: boolean;
  priceBand: string;
  brands: string[];
  colors: string[];
  onCategoryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onPriceBandChange: (value: string) => void;
  onStockChange: () => void;
  onClear: () => void;
}

/** Category listing inspired by the Exo information architecture and rendered with Vendora primitives. */
export function CatalogPage(props: CatalogPageProps) {
  const pathname = usePathname();
  const locale: Locale = getLocaleFromPathname(pathname);
  const t = getCatalogCopy(locale);
  const dispatch = useDispatch();
  const wishlist = useSelector((state: { wishlist: { wishlist: StoreProduct[] } }) => state.wishlist.wishlist);
  const cartProducts = useSelector((state: { cart: { cart_products: Array<StoreProduct & { orderQuantity: number }> } }) => state.cart.cart_products);
  const { data, isLoading, isError } = useGetShowingProductsQuery(undefined);
  const [sortIndex, setSortIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(props.category ? [props.category] : []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(props.brand ? [props.brand] : []);
  const [selectedColors, setSelectedColors] = useState<string[]>(props.color ? [props.color] : []);
  const [priceBand, setPriceBand] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const rawProducts = useMemo<StoreProduct[]>(() => data?.products ?? [], [data]);
  const products = useMemo(() => rawProducts.map(toCatalogProduct), [rawProducts]);
  const brands = useMemo(() => unique(products.map((product) => product.brand)).slice(0, 6), [products]);
  const colors = useMemo(() => unique(products.flatMap((product) => product.colors)).slice(0, 8), [products]);
  const cartByProductId = useMemo(() => new Map(cartProducts.map((item) => [item._id, item])), [cartProducts]);

  const filteredProducts = useMemo(() => {
    const result = products.filter((product) => {
      const sourceSlugs = [product.source.parent, product.source.children, product.source.category?.slug, ...(product.source.categorySlugs ?? []), ...product.tags].filter(Boolean).map((value) => toTemplateSlug(String(value)));
      if (props.Category && !sourceSlugs.includes(props.Category)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.some((value) => sourceSlugs.includes(value))) return false;
      if (selectedBrands.length > 0 && !selectedBrands.includes(toTemplateSlug(product.brand))) return false;
      if (selectedColors.length > 0 && !selectedColors.some((value) => product.colors.includes(value))) return false;
      if (inStockOnly && product.stock < 1) return false;
      if (priceBand === "under-750" && product.price >= 750000) return false;
      if (priceBand === "750-1500" && (product.price < 750000 || product.price > 1500000)) return false;
      if (priceBand === "over-1500" && product.price <= 1500000) return false;
      if (props.priceMin && product.price < Number(props.priceMin)) return false;
      if ((props.max || props.priceMax) && product.price > Number(props.max ?? props.priceMax)) return false;
      return true;
    });
    if (sortIndex === 1) return result.slice().reverse();
    if (sortIndex === 2) return result.slice().sort((a, b) => a.price - b.price);
    if (sortIndex === 3) return result.slice().sort((a, b) => b.price - a.price);
    return result;
  }, [inStockOnly, priceBand, products, props.Category, props.max, props.priceMax, props.priceMin, selectedBrands, selectedCategories, selectedColors, sortIndex]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  /** Toggles a scalar filter and returns to the first page. */
  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  };

  /** Clears every interactive filter without changing the URL-bound category. */
  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedColors([]);
    setPriceBand("");
    setInStockOnly(false);
    setPage(1);
  };

  const filterProps: FilterPanelProps = {
    locale,
    selectedCategories,
    selectedBrands,
    selectedColors,
    inStockOnly,
    priceBand,
    brands,
    colors,
    onCategoryChange: (value) => toggleFilter(setSelectedCategories, value),
    onBrandChange: (value) => toggleFilter(setSelectedBrands, value),
    onColorChange: (value) => toggleFilter(setSelectedColors, value),
    onPriceBandChange: (value) => { setPriceBand(value); setPage(1); },
    onStockChange: () => { setInStockOnly((value) => !value); setPage(1); },
    onClear: clearFilters,
  };

  return (
    <div className="vd-root min-h-screen bg-white">
      <Header />
      <main className="vd-container pb-6 pt-5 md:pt-8 lg:pt-10">
        <nav aria-label="breadcrumb" className="flex h-7 items-center gap-2 text-xs text-vd-muted">
          <Link href={withLocalePath("/", locale)} className="vd-focus rounded-sm hover:text-jade">{t.home}</Link>
          <ChevronIcon size={14} />
          <span className="font-semibold text-ink">{t.products}</span>
        </nav>

        <div className="mt-5 flex flex-col justify-between gap-4 md:mt-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-[26px] font-extrabold leading-[1.5] text-ink md:text-[34px]">{t.shopTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-vd-muted md:text-[15px]">{t.shopIntro}</p>
          </div>
          <p className="text-xs font-semibold text-vd-muted md:text-sm">{formatNumber(filteredProducts.length, locale)} {t.result}</p>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2 md:mt-8">
          {categoryCircles.slice(0, 7).map((item) => {
            const active = selectedCategories.includes(item.key);
            return <button key={item.key} type="button" onClick={() => toggleFilter(setSelectedCategories, item.key)} className={`vd-focus h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition-colors md:h-11 md:px-5 md:text-sm ${active ? "border-jade bg-jade text-white" : "border-vd-line bg-white text-ink hover:border-jade hover:text-jade"}`}>{locale === "fa" ? item.label : item.labelEn}</button>;
          })}
        </div>

        <div className="mt-5 flex h-14 items-center justify-between gap-3 rounded-[16px] border border-vd-line bg-white px-3 md:mt-7 md:px-5">
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="vd-focus flex h-10 items-center gap-2 rounded-control border border-vd-line px-3 text-xs font-bold text-ink lg:hidden"><MenuIcon size={18} />{t.showFilters}</button>
          <div className="ms-auto flex items-center gap-2">
            <label htmlFor="catalog-sort" className="hidden text-xs font-semibold text-vd-muted sm:block">{t.sortLabel}</label>
            <select id="catalog-sort" value={sortIndex} onChange={(event) => { setSortIndex(Number(event.target.value)); setPage(1); }} className="vd-focus h-10 min-w-[150px] rounded-control border border-vd-line bg-white px-3 text-xs font-bold text-ink md:min-w-[180px] md:text-sm">
              {t.sorts.map((label, index) => <option key={label} value={index}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start xl:gap-8">
          <aside className="hidden rounded-[18px] border border-vd-line bg-white p-5 lg:sticky lg:top-4 lg:block"><FilterPanel {...filterProps} /></aside>
          <section aria-label={t.products} className="min-w-0">
            {isLoading ? <CatalogSkeleton /> : null}
            {isError ? <CatalogMessage message={t.loadError} /> : null}
            {!isLoading && !isError && visibleProducts.length === 0 ? <CatalogMessage message={t.empty} /> : null}
            {!isLoading && !isError && visibleProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">
                {visibleProducts.map((product, index) => {
                  const cartItem = cartByProductId.get(product.id);
                  return (
                    <div key={product.id} className="min-h-[382px] min-w-0 md:min-h-[410px]">
                      <CatalogProductCard
                        product={product}
                        locale={locale}
                        artworkColor={index % 3 === 0 ? "jade" : index % 3 === 1 ? "clay" : "steel"}
                        favorited={wishlist.some((item) => item._id === product.id)}
                        cartQuantity={cartItem?.orderQuantity ?? 0}
                        onIncreaseCart={(item) => dispatch(cartItem ? quantityIncrement(item.source) : add_cart_product(item.source))}
                        onDecreaseCart={(item) => dispatch(quantityDecrement(item.source))}
                        onToggleFavorite={(item) => dispatch(add_to_wishlist(item.source))}
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}

            {pageCount > 1 ? <nav aria-label="Pagination" className="mt-8 flex justify-center gap-2">{Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 7).map((number) => <button key={number} type="button" onClick={() => setPage(number)} aria-current={page === number ? "page" : undefined} className={`vd-focus h-10 w-10 rounded-control border text-sm font-bold ${page === number ? "border-jade bg-jade text-white" : "border-vd-line bg-white text-ink hover:border-jade"}`}>{formatNumber(number, locale)}</button>)}</nav> : null}
          </section>
        </div>
      </main>
      <Footer />

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label={t.closeFilters} onClick={() => setMobileFiltersOpen(false)} className="absolute inset-0 bg-ink/35" />
          <aside className="absolute inset-y-0 end-0 w-[min(340px,88vw)] overflow-y-auto bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between"><p className="text-lg font-extrabold text-ink">{t.filters}</p><button type="button" onClick={() => setMobileFiltersOpen(false)} className="vd-focus flex h-10 w-10 items-center justify-center rounded-control border border-vd-line"><CloseIcon size={20} /></button></div>
            <FilterPanel {...filterProps} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

/** Sidebar controls shared by desktop and mobile filter surfaces. */
function FilterPanel(props: FilterPanelProps) {
  const t = getCatalogCopy(props.locale);
  const localizedCategories = categoryCircles.slice(0, 6);
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-base font-extrabold text-ink">{t.filters}</h2><button type="button" onClick={props.onClear} className="vd-focus rounded-sm text-[11px] font-bold text-jade hover:text-jade-dark">{t.clear}</button></div>
      <FilterSection title={t.categories}>{localizedCategories.map((item) => <FilterCheckbox key={item.key} label={props.locale === "fa" ? item.label : item.labelEn} checked={props.selectedCategories.includes(item.key)} onChange={() => props.onCategoryChange(item.key)} />)}</FilterSection>
      <FilterSection title={t.brands}>{props.brands.map((brand) => <FilterCheckbox key={brand} label={brand} checked={props.selectedBrands.includes(toTemplateSlug(brand))} onChange={() => props.onBrandChange(toTemplateSlug(brand))} />)}</FilterSection>
      {props.colors.length > 0 ? <FilterSection title={t.colors}><div className="flex flex-wrap gap-2">{props.colors.map((color) => <button key={color} type="button" onClick={() => props.onColorChange(color)} aria-pressed={props.selectedColors.includes(color)} className={`vd-focus h-9 rounded-full border px-3 text-[11px] font-bold ${props.selectedColors.includes(color) ? "border-jade bg-jade-tint text-jade" : "border-vd-line bg-white text-vd-muted"}`}>{color}</button>)}</div></FilterSection> : null}
      <FilterSection title={t.price}><div className="grid gap-2">{[["under-750", props.locale === "fa" ? "تا ۷۵۰ هزار تومان" : "Under 750K"], ["750-1500", props.locale === "fa" ? "۷۵۰ هزار تا ۱.۵ میلیون" : "750K–1.5M"], ["over-1500", props.locale === "fa" ? "بیشتر از ۱.۵ میلیون" : "Above 1.5M"]].map(([value, label]) => <FilterCheckbox key={value} label={label} checked={props.priceBand === value} onChange={() => props.onPriceBandChange(props.priceBand === value ? "" : value)} radio />)}</div></FilterSection>
      <FilterSection title={t.availability}><FilterCheckbox label={t.inStockOnly} checked={props.inStockOnly} onChange={props.onStockChange} /></FilterSection>
    </div>
  );
}

/** Visual grouping for one filter family. */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="mt-5 border-0 border-t border-vd-line pt-5"><legend className="mb-3 w-full text-sm font-extrabold text-ink">{title}</legend><div className="grid gap-2.5">{children}</div></fieldset>;
}

/** Accessible checkbox row used in every filter family. */
function FilterCheckbox({ label, checked, onChange, radio = false }: { label: string; checked: boolean; onChange: () => void; radio?: boolean }) {
  return <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-vd-muted hover:text-ink"><input type={radio ? "radio" : "checkbox"} checked={checked} onChange={onChange} className="h-4 w-4 accent-jade" />{label}</label>;
}

/** Lightweight loading grid matching final card dimensions. */
function CatalogSkeleton() {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-[382px] animate-pulse rounded-[18px] border border-vd-line bg-surface-soft md:h-[410px]" />)}</div>;
}

/** Empty and error state for the catalog result column. */
function CatalogMessage({ message }: { message: string }) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-[18px] border border-dashed border-vd-line bg-surface-soft p-8 text-center text-sm font-semibold text-vd-muted">{message}</div>;
}

/** Returns distinct non-empty values while preserving source order. */
function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
