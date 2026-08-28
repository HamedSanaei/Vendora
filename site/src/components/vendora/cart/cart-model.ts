import type { StoreProduct } from "@/components/vendora/catalog/catalog-types";

/** Product line stored by the existing Redux cart slice. */
export interface CartLine extends StoreProduct {
  orderQuantity: number;
}

/** Aggregate values shared by the cart page and mini cart. */
export interface CartTotals {
  itemCount: number;
  subtotal: number;
}

/** Returns the effective unit price after a product-level percentage discount. */
export function getCartUnitPrice(item: CartLine): number {
  const price = Number(item.originalPrice) || 0;
  const discount = Math.min(Math.max(Number(item.discount) || 0, 0), 100);
  return Math.round(price * (1 - discount / 100));
}

/** Calculates the total for a single cart line. */
export function getCartLineTotal(item: CartLine): number {
  return getCartUnitPrice(item) * Math.max(Number(item.orderQuantity) || 0, 0);
}

/** Calculates total quantity and subtotal from the current cart lines. */
export function getCartTotals(items: CartLine[]): CartTotals {
  return items.reduce<CartTotals>(
    (totals, item) => ({
      itemCount: totals.itemCount + Math.max(Number(item.orderQuantity) || 0, 0),
      subtotal: totals.subtotal + getCartLineTotal(item),
    }),
    { itemCount: 0, subtotal: 0 },
  );
}

/** Assigns a stable Penpot artwork colour when a product has no suitable image. */
export function getCartArtworkColor(productId: string): "jade" | "clay" | "steel" {
  const colors = ["jade", "clay", "steel"] as const;
  const hash = Array.from(productId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
