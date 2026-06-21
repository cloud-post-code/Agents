interface StatRowProps {
  label: string;
  value: string | number;
  subtext?: string;
  children?: React.ReactNode;
  className?: string;
}

export function StatRow({ label, value, subtext, children, className }: StatRowProps) {
  return (
    <div className={`flex items-center justify-between py-2 ${className ?? ""}`}>
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        {subtext && <span className="text-xs text-gray-400">{subtext}</span>}
        {children}
      </div>
    </div>
  );
}
