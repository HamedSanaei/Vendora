import { ProductDetailPage } from "@components/vendora/catalog/product-detail-page";

/** Compatibility entry point preserving the existing product route contract. */
export default function ShopDetailsMainArea({ id }) {
  return <ProductDetailPage id={id} />;
}
