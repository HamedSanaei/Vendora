"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useGetShowingProductsQuery } from "@/redux/features/productApi";
import { sync_cart_prices } from "@/redux/features/cartSlice";

const REFRESH_MILLISECONDS = 30 * 60 * 1000;

/** Shares one cached catalog subscription and keeps persisted cart prices aligned with internal prices. */
export function CartPriceRuntime() {
  const dispatch = useDispatch();
  const { data } = useGetShowingProductsQuery(undefined, {
    pollingInterval: REFRESH_MILLISECONDS,
    refetchOnMountOrArgChange: REFRESH_MILLISECONDS / 1000,
  });
  useEffect(() => {
    if (data?.products) dispatch(sync_cart_prices(data.products));
  }, [data, dispatch]);
  return null;
}
