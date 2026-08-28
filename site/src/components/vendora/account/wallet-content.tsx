"use client";

import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { mockTransactions, accountBalance, wishlistRecommendations } from "@/lib/vendora/account-data";
import { getDict } from "@/lib/vendora/i18n";
import type { Locale, ProductSummary } from "@/lib/vendora/types";
import { formatPrice, formatSignedAmount, localizeDigits } from "@/lib/vendora/format";
import { withLocalePath } from "@/lib/locale-path";
import { CatalogProductCard } from "@/components/vendora/catalog/catalog-product-card";
import { toCatalogProduct, type StoreProduct } from "@/components/vendora/catalog/catalog-types";
import { EmptyState } from "@/components/vendora/ui/empty-state";
import { VendoraButton } from "@/components/vendora/ui/button";
import { HeartIcon, WalletIcon } from "@/components/vendora/icons";
import { add_cart_product, quantityDecrement, quantityIncrement } from "@/redux/features/cartSlice";
import { clear_wishlist, remove_wishlist_product } from "@/redux/features/wishlist-slice";

interface WishlistReduxState {
  wishlist: { wishlist: StoreProduct[]; hydrated: boolean };
  cart: { cart_products: Array<StoreProduct & { orderQuantity: number }> };
}

/**
 * Account wishlist bound to the persisted Redux wishlist and shared cart.
 * It preserves the Penpot toolbar, responsive product grid, empty state and
 * recommendations while allowing every card action to update real state.
 */
export function WishlistContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const dispatch = useDispatch();
  const { wishlist, hydrated } = useSelector((state: WishlistReduxState) => state.wishlist);
  const cartProducts = useSelector((state: WishlistReduxState) => state.cart.cart_products);
  const items = useMemo(() => wishlist.map(toCatalogProduct), [wishlist]);
  const cartByProductId = useMemo(() => new Map(cartProducts.map((item) => [item._id, item])), [cartProducts]);

  /** Adds a Penpot recommendation to the same persisted cart used by catalog cards. */
  const addRecommendation = (product: ProductSummary) => {
    dispatch(add_cart_product(summaryToStoreProduct(product, locale)));
  };

  /** Adds wishlist products that are not already in the cart without duplicating quantities. */
  const addAllToCart = () => {
    items.forEach((product) => {
      if (product.stock > 0 && !cartByProductId.has(product.id)) {
        dispatch(add_cart_product(product.source));
      }
    });
  };

  if (!hydrated) {
    return <WishlistLoading />;
  }

  if (items.length === 0) {
    return (
      <div className="space-y-10">
        <EmptyState
          icon={<HeartIcon size={44} />}
          title={t.account.wishlist.emptyTitle}
          body={t.account.wishlist.emptyBody}
          action={
            <VendoraButton href={withLocalePath("/shop", locale)}>
              {t.account.wishlist.browseCta}
            </VendoraButton>
          }
        />
        <Recommendations locale={locale} onAdd={addRecommendation} />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex min-h-14 items-center justify-between gap-4 rounded-card bg-surface-soft px-4 py-3 md:px-5 md:py-4">
        <p className="text-sm font-semibold text-ink">
          {t.account.wishlist.toolbarCount(localizeDigits(String(items.length), locale))}
        </p>
        <button
          type="button"
          onClick={() => dispatch(clear_wishlist())}
          className="vd-focus min-h-11 rounded-control px-3 py-2 text-[0.8125rem] font-semibold text-vd-danger hover:bg-vd-danger-tint"
        >
          {t.account.wishlist.clear}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-5">
        {items.map((product, index) => {
          const cartItem = cartByProductId.get(product.id);
          return (
            <div key={product.id} className="min-h-[382px] min-w-0 md:min-h-[410px]">
              <CatalogProductCard
                product={product}
                locale={locale}
                compact
                artworkColor={index % 3 === 0 ? "jade" : index % 3 === 1 ? "clay" : "steel"}
                favorited
                cartQuantity={cartItem?.orderQuantity ?? 0}
                onIncreaseCart={(item) => dispatch(cartItem ? quantityIncrement(item.source) : add_cart_product(item.source))}
                onDecreaseCart={(item) => dispatch(quantityDecrement(item.source))}
                onToggleFavorite={(item) => dispatch(remove_wishlist_product(item.source))}
              />
            </div>
          );
        })}
      </div>

      <div className="md:hidden">
        <VendoraButton type="button" className="w-full" onClick={addAllToCart}>
          {t.account.wishlist.addAll}
        </VendoraButton>
        <section className="mt-5 min-h-[128px] rounded-card bg-vd-success-tint p-5">
          <h2 className="text-base font-bold text-jade">{t.account.wishlist.tipTitle}</h2>
          <p className="vd-text-caption mt-2 leading-6 text-vd-muted">{t.account.wishlist.tipBody}</p>
        </section>
      </div>

      <div className="hidden md:block">
        <Recommendations
          locale={locale}
          title={t.account.wishlist.recommendations}
          onAdd={addRecommendation}
        />
      </div>
    </div>
  );
}

/** Loading geometry that prevents the account page from jumping during local-storage hydration. */
function WishlistLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-14 rounded-card bg-surface-soft" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-5">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[360px] rounded-[18px] bg-surface-soft md:h-[390px]" />)}
      </div>
    </div>
  );
}

/** Adapts a Penpot recommendation summary to the existing cart product contract. */
function summaryToStoreProduct(product: ProductSummary, locale: Locale): StoreProduct {
  return {
    _id: product.slug,
    title: locale === "fa" ? product.name : product.nameEn,
    description: locale === "fa" ? product.meta : product.metaEn,
    originalPrice: product.oldPrice ?? product.price,
    discount: product.oldPrice ? Math.max(0, Math.round((1 - product.price / product.oldPrice) * 100)) : 0,
    quantity: 12,
    sku: product.id,
    parent: locale === "fa" ? "کیف‌های وندورا" : "Vendora bags",
    brand: { name: "Vendora" },
    tags: [locale === "fa" ? product.meta : product.metaEn],
    colors: ["jade"],
  };
}

function Recommendations({
  locale,
  title,
  onAdd,
}: {
  locale: Locale;
  title?: string;
  onAdd: (product: ProductSummary) => void;
}) {
  const t = getDict(locale);
  const products = useMemo(() => wishlistRecommendations.slice(0, 3).map((summary) => ({ summary, product: toCatalogProduct(summaryToStoreProduct(summary, locale)) })), [locale]);
  return (
    <section aria-label={title ?? t.account.wishlist.recommendations}>
      <h2 className="vd-text-section-title text-ink">{title ?? t.account.wishlist.recommendations}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-5">
        {products.map(({ summary, product }, index) => (
          <div key={summary.id} className="min-h-[382px] min-w-0 md:min-h-[410px]">
            <CatalogProductCard
              product={product}
              locale={locale}
              compact
              artworkColor={index % 3 === 0 ? "jade" : index % 3 === 1 ? "clay" : "steel"}
              onIncreaseCart={() => onAdd(summary)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

type TxTab = "all" | "in" | "out";

/**
 * Transactions page content (Penpot "Transactions / Desktop|Mobile"):
 * balance summary card, direction filter chips, transaction rows/cards.
 */
export function TransactionsContent({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [tab, setTab] = useState<TxTab>("all");

  const filtered = mockTransactions.filter((tx) => (tab === "all" ? true : tx.direction === tab));

  return (
    <div className="space-y-6">
      {/* Balance */}
      <section className="flex flex-col gap-6 rounded-card bg-vd-success-tint p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-jade">{t.account.transactions.balanceLabel}</p>
          <p className="mt-1 text-[1.875rem] font-bold leading-[54px] text-ink">{formatPrice(accountBalance, locale)}</p>
          <p className="vd-text-caption mt-2 text-vd-muted">{t.account.transactions.balanceHint}</p>
        </div>
        <VendoraButton href={withLocalePath("/account/quick-pay", locale)} size="lg" className="shrink-0">
          {t.account.transactions.increaseBalance}
        </VendoraButton>
      </section>

      {/* Filter tabs */}
      <div role="group" aria-label={t.account.transactions.title} className="flex flex-wrap gap-x-6 gap-y-2 rounded-card bg-surface-soft px-5 py-4 text-[0.8125rem] font-semibold">
        {(Object.keys(t.account.transactions.tabs) as (keyof typeof t.account.transactions.tabs)[]).map((key) => {
          const value = key as TxTab;
          const active = tab === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={active}
              className={`vd-focus rounded-control pb-1 transition-colors ${
                active ? "border-b-2 border-jade text-jade" : "text-vd-muted hover:text-ink"
              }`}
            >
              {t.account.transactions.tabs[key]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<WalletIcon size={44} />} title={t.account.transactions.emptyFiltered} body="" />
      ) : (
        <>
          <ul className="hidden space-y-4 md:block">
            {filtered.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-vd-line bg-white px-6 py-4"
              >
                <span className={`min-w-[140px] text-sm font-bold ${tx.direction === "in" ? "text-vd-success" : "text-ink"}`}>
                  {formatSignedAmount(tx.amount, tx.direction, locale)}{" "}
                  <span className="vd-text-caption font-normal text-vd-muted">{locale === "fa" ? "تومان" : "Toman"}</span>
                </span>
                <span className="min-w-[200px] text-sm font-medium text-ink">{tx.description}</span>
                <span className="ms-auto vd-text-caption font-medium text-ink">
                  {locale === "fa" ? tx.dateLabel : tx.dateLabelEn}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-3 md:hidden">
            {filtered.map((tx) => (
              <li key={tx.id} className="rounded-card border border-vd-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm font-bold ${tx.direction === "in" ? "text-vd-success" : "text-ink"}`}>
                    {formatSignedAmount(tx.amount, tx.direction, locale)}
                  </p>
                  <p className="vd-text-caption text-vd-muted">{locale === "fa" ? tx.dateLabel : tx.dateLabelEn}</p>
                </div>
                <p className="mt-1 text-sm text-ink">{tx.description}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className="rounded-card border border-vd-line bg-white p-6">
        <h2 className="text-[1.1875rem] font-bold text-ink">{t.account.transactions.noteTitle}</h2>
        <p className="vd-text-body mt-2 max-w-3xl text-vd-muted">{t.account.transactions.noteBody}</p>
      </section>
    </div>
  );
}
