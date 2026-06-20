import { mockStoreData } from "src/data/mock-store-data";

export async function loadCategory() {
  return {
    success: true,
    categories: mockStoreData.categories.filter((category) => category.status === "Show"),
  };
}
