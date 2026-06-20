import products from "./template/products.js";
import categories from "./template/categories.js";
import brands from "./template/brands.js";
import coupons from "./template/coupon.js";
import orders from "./template/order.js";
import users from "./template/user.js";

export const mockStoreData = {
  products,
  categories,
  brands,
  coupons,
  orders,
  users,
};

export function getProductById(id) {
  return products.find((product) => product._id === id || product.id === id) ?? products[0];
}

export function getRelatedProducts(tags = []) {
  if (!tags.length) {
    return products.slice(0, 4);
  }

  return products.filter((product) => product.tags?.some((tag) => tags.includes(tag))).slice(0, 4);
}
