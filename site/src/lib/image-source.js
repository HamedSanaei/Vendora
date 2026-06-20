const defaultFallbackImage = "/assets/img/product/product-1.jpg";

/**
 * Returns true when an image is served by the ASP.NET Core upload endpoint.
 */
export function isApiUploadImage(src) {
  return typeof src === "string" && src.includes("/uploads/");
}

/**
 * Builds safe props for Next Image while bypassing optimization for local API uploads.
 */
export function getSafeImageProps(src, fallback = defaultFallbackImage) {
  const safeSrc = src || fallback;

  return {
    src: safeSrc,
    unoptimized: isApiUploadImage(safeSrc),
  };
}
