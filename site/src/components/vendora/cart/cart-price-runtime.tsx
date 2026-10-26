"use client";

import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useGetShowingProductsQuery } from "@/redux/features/productApi";
import { apiSlice } from "@/redux/api/apiSlice";
import { sync_cart_prices } from "@/redux/features/cartSlice";

import { useShippingPolicy } from "@/lib/shipping-client";

const REFRESH_MILLISECONDS = 30 * 60 * 1000;

/** Shares one cached catalog subscription and keeps persisted cart prices aligned with internal prices. */
export function CartPriceRuntime() {
  const dispatch = useDispatch();
  const policy = useShippingPolicy();
  const previous = useRef(policy.version);
  const { data } = useGetShowingProductsQuery(undefined, {
    pollingInterval: REFRESH_MILLISECONDS,
    refetchOnMountOrArgChange: REFRESH_MILLISECONDS / 1000,
  });
  useEffect(() => {
    if (previous.current !== policy.version) { previous.current = policy.version; dispatch(apiSlice.util.invalidateTags(["Products", "Discount", "Product", "RelatedProducts"])); }
  }, [policy.version, dispatch]);
  useEffect(() => {
    if (data?.products) dispatch(sync_cart_prices(data.products));
  }, [data, dispatch]);
  return null;
}
