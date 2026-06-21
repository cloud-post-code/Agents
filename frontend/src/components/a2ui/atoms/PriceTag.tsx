interface PriceTagProps {
  amount: number;
  currency?: string;
  className?: string;
}

export function PriceTag({ amount, currency = "USD", className }: PriceTagProps) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);

  return (
    <span className={`inline-flex items-center font-semibold ${className ?? ""}`}>
      {formatted}
    </span>
  );
}
