import { CatalogPage } from "@components/vendora/catalog/catalog-page";

/**
 * Compatibility entry point for the localized shop route.
 * Business query parameters are preserved while presentation is delegated to
 * the isolated Vendora catalog implementation.
 */
export default function ShopMainArea(props) {
  return <CatalogPage {...props} />;
}
