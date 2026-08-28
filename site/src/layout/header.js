/**
 * Layout shim: every page imports the header from here, so the whole
 * storefront now renders the Penpot-based Vendora header.
 * The previous Harri-template implementation was replaced by
 * `@components/vendora/layout/store-chrome` (StoreHeader).
 */
export { StoreHeader as default } from "@components/vendora/layout/store-chrome";
