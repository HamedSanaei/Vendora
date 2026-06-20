"use client";
import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// internal
import ErrorMessage from "@components/error-message/error";
import { useGetCategoriesQuery } from "src/redux/features/categoryApi";
import ShopCategoryLoader from "@components/loader/shop-category-loader";
import {
  buildLocalizedShopPath,
  getLocaleFromPathname,
  toTemplateSlug,
} from "@lib/locale-path";

const ShopCategory = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPathname(pathname);
  const selectedParent = searchParams.get("Category");
  const selectedChild = searchParams.get("category");
  const hasSelectedCategory = Boolean(selectedParent || selectedChild);
  const { data: categories, isLoading, isError } = useGetCategoriesQuery();
  let content = null;

  if (isLoading) {
    content = <ShopCategoryLoader loading={isLoading}/>;
  }

  if (!isLoading && isError) {
    content = <ErrorMessage message={locale === "fa" ? "خطایی رخ داد" : "There was an error"} />;
  }

  if (!isLoading && !isError && categories?.categories?.length === 0) {
    content = <ErrorMessage message={locale === "fa" ? "دسته‌بندی پیدا نشد" : "No category found!"} />;
  }

  if (!isLoading && !isError && categories?.categories?.length > 0) {
    content = categories.categories.map((category, index) => {
      const children = getCategoryChildren(category);
      const hasChildren = children.length > 0;
      const categoryLabel = category.title || category.parent || category.name;
      const categorySlug = category.slug || category.children || categoryLabel;
      const normalizedCategorySlug = toTemplateSlug(categorySlug);
      const isOpen =
        hasChildren &&
        (hasSelectedCategory
          ? selectedParent === normalizedCategorySlug ||
            categoryHasDescendantSlug(children, selectedChild)
          : index === 0);

      return (
        <div key={category._id || category.id || index} className="card">
          <div className="card-header white-bg" id={`heading-${index + 1}`}>
            <h5 className="mb-0">
              <button
                className={`shop-accordion-btn ${isOpen ? "" : "collapsed"} ${hasChildren ? "" : "category-leaf"}`}
                {...(hasChildren
                  ? {
                      "data-bs-toggle": "collapse",
                      "data-bs-target": `#collapse-${index + 1}`,
                      "aria-expanded": isOpen ? "true" : "false",
                      "aria-controls": `collapse-${index + 1}`,
                    }
                  : {})}
                onClick={() => navigateCategory(router, locale, categorySlug, true)}
              >
                {categoryLabel}
              </button>
            </h5>
          </div>

          {hasChildren ? (
            <div
              id={`collapse-${index + 1}`}
              className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}
              aria-labelledby={`heading-${index + 1}`}
              data-bs-parent="#accordion-items"
            >
              <div className="card-body">
                <div className="categories__list">
                  <ul>{renderCategoryChildren(children, locale, router)}</ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <div className="accordion-item">
      <div className="sidebar__widget-content">
        <div className="categories">
          <div id="accordion-items">{content}</div>
        </div>
      </div>
    </div>
  );
};

function getCategoryChildren(category) {
  return Array.isArray(category.children) ? category.children : [];
}

function categoryHasDescendantSlug(children, selectedSlug) {
  if (!selectedSlug) {
    return false;
  }

  return children.some((child) => {
    if (typeof child === "string") {
      return toTemplateSlug(child) === selectedSlug;
    }

    const childSlug = child.slug || child.title || child.name;
    return (
      toTemplateSlug(childSlug) === selectedSlug ||
      categoryHasDescendantSlug(getCategoryChildren(child), selectedSlug)
    );
  });
}

function renderCategoryChildren(children, locale, router) {
  return children.map((child, index) => {
    if (typeof child === "string") {
      return <CategoryLink key={`${child}-${index}`} label={child} slug={child} locale={locale} router={router} />;
    }

    const nestedChildren = getCategoryChildren(child);

    return (
      <li key={child.id || child._id || index}>
        <CategoryAnchor label={child.title || child.name} slug={child.slug || child.title || child.name} locale={locale} router={router} />
        {nestedChildren.length > 0 ? (
          <ul className="category-nested-list">{renderCategoryChildren(nestedChildren, locale, router)}</ul>
        ) : null}
      </li>
    );
  });
}

function CategoryLink({ label, slug, locale, router }) {
  return (
    <li>
      <CategoryAnchor label={label} slug={slug} locale={locale} router={router} />
    </li>
  );
}

function CategoryAnchor({ label, slug, locale, router }) {
  return (
    <a
      onClick={() => navigateCategory(router, locale, slug, false)}
      style={{ cursor: "pointer", textTransform: "capitalize" }}
    >
      {label}
    </a>
  );
}

function navigateCategory(router, locale, slug, isParent) {
  router.push(
    buildLocalizedShopPath(locale, {
      [isParent ? "Category" : "category"]: toTemplateSlug(slug),
    })
  );
}

export default ShopCategory;
