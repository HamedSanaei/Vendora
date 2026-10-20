"use client";

import { useMemo, useState, useTransition } from "react";
import { useDispatch, useSelector } from "react-redux";
import Header from "@/layout/header";
import Footer from "@/layout/footer";
import { ChevronIcon, CloseIcon, MenuIcon } from "@/components/vendora/icons";
import type { CatalogCategory, CatalogSearchResult, CategoryDetail } from "@/lib/catalog-contracts";
import { mapCatalogProduct } from "@/lib/catalog-product-mapping";
import { ProductArticle } from "./product-article";
import { formatNumber } from "@/lib/vendora/format";
import { getLocaleFromPathname, withLocalePath } from "@/lib/locale-path";
import type { Locale } from "@/lib/vendora/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { resolveApiImageUrl } from "@/lib/http";
import { add_cart_product, quantityDecrement, quantityIncrement } from "@/redux/features/cartSlice";
import { add_to_wishlist } from "@/redux/features/wishlist-slice";
import { CatalogProductCard } from "./catalog-product-card";
import { getCatalogCopy } from "./catalog-copy";
import type { CatalogProductModel, StoreProduct } from "./catalog-types";
import { toCatalogProduct } from "./catalog-types";

export interface CatalogPageProps {
  result: CatalogSearchResult;
  tree: CatalogCategory[];
  brands: Array<{name: string; slug: string}>;
  colors: Array<{name: string; slug: string}>;
  category?: CategoryDetail;
}

interface FilterPanelProps {
  locale: Locale;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedColors: string[];
  inStockOnly: boolean;
  priceBand: string;
  categories: Array<{name: string; slug: string}>;
  brands: Array<{name: string; slug: string}>;
  colors: Array<{name: string; slug: string}>;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const products = useMemo(() => props.result.products.map(item => toCatalogProduct(mapCatalogProduct(item))), [props.result]);
  const cartByProductId = useMemo(() => new Map(cartProducts.map((item) => [item._id, item])), [cartProducts]);
  const categories = useMemo(() => flattenCategories(props.tree), [props.tree]);
  const selectedCategories = searchParams.getAll("category").length ? searchParams.getAll("category") : searchParams.getAll("Category");
  const selectedBrands = searchParams.getAll("brand");
  const selectedColors = searchParams.getAll("color");
  const sortOptions = ["newest", "oldest", "priceAsc", "priceDesc"];
  const sortIndex = Math.max(0, sortOptions.indexOf(searchParams.get("sort") || "newest"));
  const inStockOnly = searchParams.get("inStock") === "true";
  const min = searchParams.get("priceMin"), max = searchParams.get("priceMax") || searchParams.get("max");
  const priceBand = min === "1500000" ? "over-1500" : min === "750000" ? "750-1500" : max === "750000" ? "under-750" : "";
  const page = props.result.page;
  const pageCount = Math.max(1, Math.ceil(props.result.total / props.result.pageSize));
  const visibleProducts = products;

  /** Real links keep paginated results discoverable without requiring JavaScript execution. */
  const pageHref = (number: number): string => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("page",String(number));
    return `${pathname}?${query}`;
  };

  /** URL state is authoritative; the server handles subtree filtering, sorting and unique pagination. */
  const update = (changes: Record<string, string | string[] | null>) => {
    const query = new URLSearchParams(searchParams.toString());
    if (!query.has("category")) for (const value of query.getAll("Category")) query.append("category",value);
    if (!query.has("priceMax") && query.has("max")) query.set("priceMax",query.get("max")!);
    query.delete("Category"); query.delete("max");
    if (!("page" in changes)) query.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      query.delete(key);
      for (const entry of Array.isArray(value) ? value : value ? [value] : []) query.append(key, entry);
    }
    startTransition(() => router.push(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false }));
  };
  /** Parent/child selections remain independent and are combined with OR by the catalog API. */
  const toggleFilter = (key: string, selected: string[], value: string) => update({[key]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]});
  const filterProps: FilterPanelProps = {
    locale, selectedCategories, selectedBrands, selectedColors, inStockOnly, priceBand,
    categories, brands: props.brands, colors: props.colors,
    onCategoryChange: value => toggleFilter("category", selectedCategories, value),
    onBrandChange: value => toggleFilter("brand", selectedBrands, value),
    onColorChange: value => toggleFilter("color", selectedColors, value),
    onPriceBandChange: value => update({priceMin: value === "over-1500" ? "1500000" : value === "750-1500" ? "750000" : null, priceMax: value === "under-750" ? "750000" : value === "750-1500" ? "1500000" : null}),
    onStockChange: () => update({inStock: inStockOnly ? null : "true"}),
    onClear: () => startTransition(() => router.push(pathname, {scroll:false})),
  };

  return (
    <div className="vd-root min-h-screen bg-white">
      <Header />
      <main className="vd-container pb-6 pt-5 md:pt-8 lg:pt-10">
        <nav aria-label="breadcrumb" className="flex h-7 items-center gap-2 text-xs text-vd-muted">
          <Link href={withLocalePath("/", locale)} className="vd-focus rounded-sm hover:text-jade">{t.home}</Link>
          <ChevronIcon size={14} />
          <Link href={withLocalePath("/shop", locale)}>{t.products}</Link>{props.category?.breadcrumbs.map(item => <span className="contents" key={item.id}><ChevronIcon size={14} /><Link className="truncate" href={withLocalePath(`/category/${encodeURIComponent(item.slug)}`, locale)}>{item.name}</Link></span>)}
        </nav>

        <div className="mt-5 flex flex-col justify-between gap-4 md:mt-6 md:flex-row md:items-end">
          <div>
            {props.category?.imageUrl && <Image src={resolveApiImageUrl(props.category.imageUrl)} alt={props.category.name} width={160} height={120} unoptimized className="mb-4 h-28 w-40 rounded-control object-contain" />}
            <h1 className="text-[26px] font-extrabold leading-[1.5] text-ink md:text-[34px]">{props.category?.name ?? t.shopTitle}</h1>
            {props.category?.descriptionHtml ? <div className="mt-3 max-w-3xl"><ProductArticle content={props.category.descriptionHtml} /></div> : !props.category ? <p className="mt-2 max-w-2xl text-sm leading-7 text-vd-muted md:text-[15px]">{t.shopIntro}</p> : null}
          </div>
          <p className="text-xs font-semibold text-vd-muted md:text-sm">{formatNumber(props.result.total, locale)} {t.result}</p>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2 md:mt-8">
          {(props.category?.children ?? props.tree).map(item => <Link key={item.id} href={withLocalePath(`/category/${encodeURIComponent(item.slug)}`, locale)} className="vd-focus flex min-h-11 shrink-0 items-center rounded-full border border-vd-line px-4 text-xs font-bold text-ink hover:border-jade hover:text-jade">{item.name}</Link>)}

        </div>

        <div className="mt-5 flex h-14 items-center justify-between gap-3 rounded-[16px] border border-vd-line bg-white px-3 md:mt-7 md:px-5">
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="vd-focus flex h-11 items-center gap-2 rounded-control border border-vd-line px-3 text-xs font-bold text-ink lg:hidden"><MenuIcon size={18} />{t.showFilters}</button>
          <div className="ms-auto flex items-center gap-2">
            <label htmlFor="catalog-sort" className="hidden text-xs font-semibold text-vd-muted sm:block">{t.sortLabel}</label>
            <select id="catalog-sort" value={sortIndex} onChange={(event) => update({sort:sortOptions[Number(event.target.value)]})} className="vd-focus h-11 min-w-[150px] rounded-control border border-vd-line bg-white px-3 text-xs font-bold text-ink md:min-w-[180px] md:text-sm">
              {t.sorts.map((label, index) => <option key={label} value={index}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start xl:gap-8">
          <aside className="hidden rounded-[18px] border border-vd-line bg-white p-5 lg:sticky lg:top-4 lg:block"><FilterPanel {...filterProps} /></aside>
          <section aria-label={t.products} aria-busy={isLoading} className="min-w-0">
            {isLoading ? <CatalogSkeleton /> : null}

            {!isLoading && visibleProducts.length === 0 ? <CatalogMessage message={t.empty} /> : null}
            {!isLoading && visibleProducts.length > 0 ? (
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

            {pageCount > 1 ? <nav aria-label="Pagination" className="mt-8 flex justify-center gap-2">{Array.from({ length: pageCount }, (_, index) => index + 1).filter(number => number === 1 || number === pageCount || Math.abs(number - page) <= 2).map((number) => <Link key={number} href={pageHref(number)} prefetch={false} aria-current={page === number ? "page" : undefined} className={`vd-focus flex h-11 w-11 items-center justify-center rounded-control border text-sm font-bold ${page === number ? "border-jade bg-jade text-white" : "border-vd-line bg-white text-ink hover:border-jade"}`}>{formatNumber(number, locale)}</Link>)}</nav> : null}
          </section>
        </div>
      </main>
      <Footer />

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label={t.closeFilters} onClick={() => setMobileFiltersOpen(false)} className="absolute inset-0 bg-ink/35" />
          <aside className="absolute inset-y-0 end-0 w-[min(340px,88vw)] overflow-y-auto bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between"><p className="text-lg font-extrabold text-ink">{t.filters}</p><button type="button" onClick={() => setMobileFiltersOpen(false)} className="vd-focus flex h-11 w-11 items-center justify-center rounded-control border border-vd-line"><CloseIcon size={20} /></button></div>
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
  const localizedCategories = props.categories;
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="text-base font-extrabold text-ink">{t.filters}</h2><button type="button" onClick={props.onClear} className="vd-focus rounded-sm text-[11px] font-bold text-jade hover:text-jade-dark">{t.clear}</button></div>
      <FilterSection title={t.categories}><div className="max-h-96 overflow-y-auto pe-1">{localizedCategories.map((item) => <FilterCheckbox key={item.slug} label={item.name} checked={props.selectedCategories.includes(item.slug)} onChange={() => props.onCategoryChange(item.slug)} />)}</div></FilterSection>
      <FilterSection title={t.brands}>{props.brands.map((brand) => <FilterCheckbox key={brand.slug} label={brand.name} checked={props.selectedBrands.includes(brand.slug)} onChange={() => props.onBrandChange(brand.slug)} />)}</FilterSection>
      {props.colors.length > 0 ? <FilterSection title={t.colors}><div className="flex flex-wrap gap-2">{props.colors.map((color) => <button key={color.slug} type="button" onClick={() => props.onColorChange(color.slug)} aria-pressed={props.selectedColors.includes(color.slug)} className={`vd-focus min-h-11 rounded-full border px-3 text-[11px] font-bold ${props.selectedColors.includes(color.slug) ? "border-jade bg-jade-tint text-jade" : "border-vd-line bg-white text-vd-muted"}`}>{color.name}</button>)}</div></FilterSection> : null}
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
  return <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs font-medium text-vd-muted hover:text-ink"><input type={radio ? "radio" : "checkbox"} checked={checked} onChange={onChange} className="h-4 w-4 accent-jade" />{label}</label>;
}

/** Lightweight loading grid matching final card dimensions. */
function CatalogSkeleton() {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3 xl:gap-5">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-[382px] animate-pulse rounded-[18px] border border-vd-line bg-surface-soft md:h-[410px]" />)}</div>;
}

/** Empty and error state for the catalog result column. */
function CatalogMessage({ message }: { message: string }) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-[18px] border border-dashed border-vd-line bg-surface-soft p-8 text-center text-sm font-semibold text-vd-muted">{message}</div>;
}

/** Flattens the already-public tree while retaining each category path as a readable filter label. */
function flattenCategories(tree: CatalogCategory[], ancestors: string[] = []): Array<{name: string; slug: string}> {
  return tree.flatMap(item => [{name:[...ancestors,item.name].join(" / "),slug:item.slug},...flattenCategories(item.children,[...ancestors,item.name])]);
}
