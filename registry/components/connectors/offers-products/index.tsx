import { NativeSelect } from "@/components/native-select";
import { emptyLine, type OfferLine } from "@/components/plugins/offers/model";
import type { CatalogProduct } from "@/components/plugins/products/model";
export function productLine(product: CatalogProduct): OfferLine {
  return {
    ...emptyLine(),
    description: [product.name, product.description].filter(Boolean).join("\n").slice(0, 2000),
    priceMinor: product.priceMinor ?? 0,
  };
}
/** Supply the authorized, localized catalog in the same currency as the offer. */
export function OfferProductPicker({
  products,
  onAdd,
  label = "Add product",
}: {
  products: readonly CatalogProduct[];
  onAdd: (line: OfferLine) => void;
  label?: string;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value=""
      onChange={(event) => {
        const p = products.find((item) => item.id === event.target.value);
        if (p) onAdd(productLine(p));
      }}
    >
      <option value="">{label}</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}
