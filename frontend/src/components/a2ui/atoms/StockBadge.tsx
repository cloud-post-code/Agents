interface StockBadgeProps {
  quantity: number;
  lowThreshold?: number;
  outThreshold?: number;
  className?: string;
}

export function StockBadge({ quantity, lowThreshold = 5, outThreshold = 0, className }: StockBadgeProps) {
  let label: string;
  let color: string;

  if (quantity <= outThreshold) {
    label = "Out of stock";
    color = "bg-red-100 text-red-700";
  } else if (quantity <= lowThreshold) {
    label = `Low stock (${quantity})`;
    color = "bg-amber-100 text-amber-700";
  } else {
    label = `In stock (${quantity})`;
    color = "bg-green-100 text-green-700";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color} ${className ?? ""}`}>
      {label}
    </span>
  );
}
