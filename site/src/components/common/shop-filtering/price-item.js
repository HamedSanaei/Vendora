import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildLocalizedShopPath, getLocaleFromPathname } from "@lib/locale-path";

const PriceItem = ({ id, min, max }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPathname(pathname);
  const priceMin = searchParams.get("priceMin");
  const priceMax = searchParams.get("priceMax");

  // handlePrice
  const handlePrice = (min, max) => {
    if (min) {
      router.push(buildLocalizedShopPath(locale, { priceMin: min, max }));
    } else {
      router.push(buildLocalizedShopPath(locale, { priceMax: max }));
    }
  };
  return (
    <div className="shop__widget-list-item">
      <input
        onChange={() => handlePrice(min, max)}
        type="checkbox"
        id={`higher-${id}`}
        checked={
          priceMin === `${min}` ||
          priceMax === `${max}`
            ? "checked"
            : false
        }
      />
      {max < 200 ? (
        <label htmlFor={`higher-${id}`}>
          ${min}.00 - ${max}.00
        </label>
      ) : (
        <label htmlFor={`higher-${id}`}>
          ${max}.00+
        </label>
      )}
    </div>
  );
};

export default PriceItem;
