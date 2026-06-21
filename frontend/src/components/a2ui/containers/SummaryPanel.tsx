interface SummaryPanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function SummaryPanel({ title, children, className }: SummaryPanelProps) {
  return (
    <div className={`bg-white border rounded-xl p-5 ${className ?? ""}`}>
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
