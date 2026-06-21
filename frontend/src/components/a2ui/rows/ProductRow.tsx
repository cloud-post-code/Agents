import { PriceTag } from "../atoms/PriceTag";
import { StockBadge } from "../atoms/StockBadge";

interface ProductRowProps {
  name: string;
  sku?: string;
  price?: number;
  stockQty?: number;
  lowThreshold?: number;
  className?: string;
}

export function ProductRow({ name, sku, price, stockQty, lowThreshold = 5, className }: ProductRowProps) {
  return (
    <tr className={className}>
      <td className="py-2 pr-4 font-medium">{name}</td>
      {sku && <td className="py-2 pr-4 text-gray-500 text-sm">{sku}</td>}
      {price !== undefined && <td className="py-2 pr-4"><PriceTag amount={price} /></td>}
      {stockQty !== undefined && (
        <td className="py-2">
          <StockBadge quantity={stockQty} lowThreshold={lowThreshold} />
        </td>
      )}
    </tr>
  );
}
