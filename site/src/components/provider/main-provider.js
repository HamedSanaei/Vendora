"use client";
import { useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Provider, useDispatch } from "react-redux";
import { store } from "src/redux/store";
import { get_cart_products } from "src/redux/features/cartSlice";
import { get_wishlist_products } from "src/redux/features/wishlist-slice";
import { CartToastViewport } from "@components/vendora/feedback/cart-toast";
if (typeof window !== "undefined") {
  require("bootstrap/dist/js/bootstrap");
}

// stripePromise
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);

/** Hydrates persisted storefront state once and mounts shared cart feedback. */
function StorefrontRuntime({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(get_cart_products());
    dispatch(get_wishlist_products());
  }, [dispatch]);

  return (
    <>
      {children}
      <CartToastViewport />
    </>
  );
}

/** Provides the Redux, payment, and cart runtimes used by the storefront. */
export default function MainProvider({ children }) {
  return (
    <Provider store={store}>
      <Elements stripe={stripePromise}>
        <StorefrontRuntime>{children}</StorefrontRuntime>
      </Elements>
    </Provider>
  );
}
