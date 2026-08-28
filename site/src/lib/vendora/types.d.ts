/**
 * Shared typed models for the Vendora storefront UI.
 *
 * These shapes are mock-first (see `account-data.ts` / `catalog.ts`) but are
 * designed so the components can later bind to the ASP.NET Core API without
 * changing their props contracts.
 */
export type Locale = "fa" | "en";
/** Order lifecycle status shown with the Penpot status badge palette. */
export type OrderStatus = "awaiting_payment" | "processing" | "shipped" | "delivered" | "cancelled";
export type ReturnStatus = "under_review" | "approved" | "rejected";
export interface ProductSummary {
    id: string;
    slug: string;
    name: string;
    nameEn: string;
    meta: string;
    metaEn: string;
    price: number;
    /** Optional crossed-out original price. */
    oldPrice?: number;
    /** e.g. free shipping badge on the media area. */
    badge?: {
        key: "free_shipping";
        label: string;
        labelEn: string;
    } | null;
}
export interface CategoryLink {
    key: string;
    /** Persian label (design source of truth). */
    label: string;
    labelEn: string;
    href: string;
}
export interface MegaMenuGroup {
    title: string;
    titleEn: string;
    items: {
        label: string;
        labelEn: string;
        href: string;
    }[];
}
export interface MegaMenuCategory extends CategoryLink {
    groups: MegaMenuGroup[];
}
export interface OrderItemLine {
    id: string;
    name: string;
    quantity: number;
    price: number;
    artworkColor?: "jade" | "clay" | "steel";
}
export interface OrderSummary {
    id: string;
    /** Human readable order code, e.g. VD-1048. */
    code: string;
    status: OrderStatus;
    itemCount: number;
    total: number;
    /** Preformatted display date from the mock layer (Jalali for fa). */
    dateLabel: string;
    /** English display variant of `dateLabel`. */
    dateLabelEn: string;
}
export interface OrderDetail extends OrderSummary {
    placedAtLabel: string;
    placedAtLabelEn: string;
    paymentMethod: string;
    shippingMethod: string;
    /** Index of the furthest completed step (0-based) in the 5-step timeline. */
    progressStep: number;
    items: OrderItemLine[];
    itemsSubtotal: number;
    shippingCost: number;
    shippingAddress: {
        title: string;
        address: string;
        recipient: string;
    };
}
export interface AddressBookEntry {
    id: string;
    title: string;
    isDefault: boolean;
    address: string;
    recipient: string;
    phoneMasked: string;
}
export interface ReturnRequestSummary {
    id: string;
    code: string;
    status: ReturnStatus;
    orderCode: string;
    item: string;
    reason: string;
    submittedLabel: string;
    submittedLabelEn: string;
}
export interface TransactionRowModel {
    id: string;
    description: string;
    amount: number;
    direction: "in" | "out";
    dateLabel: string;
    dateLabelEn: string;
}
export interface WishlistEntry {
    product: ProductSummary;
}
export interface AccountProfile {
    fullName: string;
    fullNameEn: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    memberBadge: string;
    memberBadgeEn: string;
    clubPoints: number;
    clubPointsToNext: number;
}
