
import { ProductRoute, productMetadata } from "@/components/vendora/catalog/product-route";


export async function generateMetadata({ params }) { return productMetadata((await params).id); }

const ProductDetailsPage = async ({ params }) => {
  const { id } = await params;
  return <ProductRoute identifier={id} legacy />;
};

export default ProductDetailsPage;
