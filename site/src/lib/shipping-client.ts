"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { http } from "./http";
import type { CartLine } from "@/components/vendora/cart/cart-model";
import { getCartUnitPrice } from "@/components/vendora/cart/cart-model";

export interface ShippingPolicyState { includedInPrice: boolean; unitAmount: number; version: number; ready?: boolean; failed?: boolean }
export interface ShippingQuoteResult { id: string | null; cost: number; paymentMode: "free" | "prepaid" | "collect"; expiresAtUtc: string | null; policyVersion: number; subtotal: number; discount: number; payable: number }
export interface ShippingCity { code: string; name: string; province: string }
const initial: ShippingPolicyState = { includedInPrice: false, unitAmount: 250000, version: 1, ready: false };
let current = initial, checkedAt = 0, pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** One bounded public policy read, shared by all consumers; no carrier request is made by this endpoint. */
export function refreshShippingPolicy(force = false): Promise<void> {
  if (pending) return pending;
  if (!force && Date.now() - checkedAt < 30000) return Promise.resolve();
  pending = http.get<ShippingPolicyState>("/shipping/policy").then(({ data }) => {
    if (typeof data.includedInPrice !== "boolean" || !Number.isFinite(data.unitAmount) || !Number.isInteger(data.version) || data.unitAmount < 0 || data.version < 1) throw new Error("Invalid shipping policy");
    checkedAt = Date.now();
    const next = { ...data, ready: true, failed: false };
    if (JSON.stringify(next) !== JSON.stringify(current)) { current = next; listeners.forEach(listener => listener()); }
  }).catch(() => { checkedAt = Date.now(); current = { ...current, failed: true }; listeners.forEach(listener => listener()); }).finally(() => { pending = null; });
  return pending;
}

/** Subscribes to the shared policy; focus refresh is deduplicated and never polls the carrier. */
export function useShippingPolicy(): ShippingPolicyState {
  const state = useSyncExternalStore(subscribe, () => current, () => initial);
  useEffect(() => { void refreshShippingPolicy(); }, []);
  return state;
}

/** Shares a single browser event listener and removes it when the last consumer unmounts. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("focus", onFocus);
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener("focus", onFocus); };
}

/** Requests server-owned pricing and address checks; client unit prices only detect a changed price. */
export async function requestShippingQuote(token: string, addressId: string, items: CartLine[], method: string, couponCode?: string, destinationCityCode?: string, signal?: AbortSignal): Promise<ShippingQuoteResult> {
  return (await http.post<ShippingQuoteResult>("/shipping/quote", { addressId, method, couponCode, destinationCityCode,
    items: items.map(item => ({ productId: item._id, quantity: item.orderQuantity, expectedUnitPrice: getCartUnitPrice(item) })) }, { headers: { Authorization: `Bearer ${token}` }, signal })).data;
}

/** Loads normalized city references through the shared server transport; carrier credentials stay server-side. */
export async function requestPostexCities(token: string, signal?: AbortSignal): Promise<ShippingCity[]> {
  return (await http.get<{ items: ShippingCity[] }>("/shipping/reference/cities", { headers: { Authorization: `Bearer ${token}` }, signal })).data.items;
}

/** Gives stable localized actions without leaking provider response bodies or mislabelling collect shipping as free. */
export function shippingError(error: unknown, fa: boolean): string {
  const code: unknown = axios.isAxiosError(error) ? error.response?.data?.code : null;
  const text: Record<string, [string, string]> = {
    INVALID_COUPON: ["کد تخفیف معتبر نیست یا منقضی شده است.", "The coupon is invalid or expired."],
    COUPON_NOT_APPLICABLE: ["کد تخفیف برای کالاهای این سبد قابل استفاده نیست.", "This coupon does not apply to your cart."],
    PRICE_CHANGED: ["قیمت کالا تغییر کرده است؛ سبد را به‌روز و دوباره تأیید کنید.", "Prices changed. Refresh your cart and confirm again."],
    POSTEX_NOT_CONFIGURED: ["ارسال پستی هنوز به سرویس متصل نشده است؛ روش دیگری انتخاب کنید.", "Postal shipping is not configured. Choose another method."],
    PACKAGE_NOT_CONFIGURED: ["بسته‌بندی مناسب این تعداد کالا تعریف نشده است؛ روش دیگری انتخاب کنید.", "No parcel profile matches this quantity. Choose another method."],
    PRODUCT_WEIGHT_MISSING: ["وزن بعضی کالاها ثبت نشده است؛ فعلاً روش دیگری انتخاب کنید.", "Some product weights are missing. Choose another method."],
    POSTEX_CITY_SELECTION_REQUIRED: ["شهر مقصد در فهرست پستِکس یکتا نیست؛ کد شهر معتبر را از فهرست انتخاب کنید.", "Select a matching destination city from the carrier list."],
    FREIGHT_MIN_QUANTITY: ["باربری برای سفارش‌های بیش از ۱۰ عدد قابل انتخاب است.", "Freight requires more than ten units."],
    SHIPPING_QUOTE_EXPIRED: ["استعلام ارسال تغییر کرده یا منقضی شده است؛ دوباره استعلام بگیرید.", "The delivery quote changed or expired. Request a new quote."],
    SHIPPING_POLICY_CHANGED: ["تنظیمات ارسال تغییر کرده است؛ صفحه را تازه کنید و دوباره تأیید کنید.", "Shipping settings changed. Refresh and confirm again."],
  };
  return typeof code === "string" && text[code] ? text[code][fa ? 0 : 1] : fa ? "استعلام ارسال انجام نشد. دوباره تلاش یا روش دیگری انتخاب کنید." : "Delivery pricing failed. Retry or choose another method.";
}

/** Stable checkout binding, excluding transient quote metadata and user credentials. */
export function shippingCartFingerprint(items: CartLine[], couponCode?: string): string {
  return JSON.stringify({ items: items.map(item => ({ id: item._id, quantity: item.orderQuantity, price: getCartUnitPrice(item) })).sort((a,b) => a.id.localeCompare(b.id)), couponCode: couponCode ?? "" });
}

/** Shares the server's coupon scope/caps with the existing cart; no delivery quote or carrier request is involved. */
export function useCartPricing(items: CartLine[], couponCode: string | undefined, fa: boolean) {
  const policy = useShippingPolicy();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([shippingCartFingerprint(items, couponCode), policy.version, attempt]);
  const [result, setResult] = useState<{ key: string; data?: Pick<ShippingQuoteResult, "subtotal" | "discount" | "payable">; error?: string } | null>(null);
  const active = Boolean(items.length && couponCode);
  useEffect(() => {
    if (!active || !policy.ready) return;
    const controller = new AbortController();
    void http.post<ShippingQuoteResult>("/shipping/cart-pricing", {
      items: items.map(item => ({ productId: item._id, quantity: item.orderQuantity, expectedUnitPrice: getCartUnitPrice(item) })), couponCode,
    }, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(error => { if (!controller.signal.aborted) setResult({ key, error: shippingError(error, fa) }); });
    return () => controller.abort();
  }, [active, items, couponCode, key, policy.ready, fa]);
  return { data: active && result?.key === key ? result.data : undefined,
    pending: active && (result?.key !== key), error: active && result?.key === key ? result.error : undefined,
    retry: () => setAttempt(value => value + 1) };
}

/** Refreshes shared policy on return to the browser without bypassing the normal read throttle. */
function onFocus() { void refreshShippingPolicy(); }
