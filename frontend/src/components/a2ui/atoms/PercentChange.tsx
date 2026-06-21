interface PercentChangeProps {
  value: number;
  className?: string;
}

export function PercentChange({ value, className }: PercentChangeProps) {
  const isPositive = value >= 0;
  const color = isPositive ? "text-green-600" : "text-red-600";
  const arrow = isPositive ? "↑" : "↓";
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${color} ${className ?? ""}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}
