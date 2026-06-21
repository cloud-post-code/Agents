const MAX_VISIBLE = 4;

interface CompareGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function CompareGrid<T>({ items, renderItem, className }: CompareGridProps<T>) {
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - MAX_VISIBLE;

  return (
    <div className={`grid grid-cols-2 gap-3 ${className ?? ""}`}>
      {visible.map((item, i) => (
        <div key={i} className="border rounded-lg p-3">
          {renderItem(item, i)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="border rounded-lg p-3 flex items-center justify-center text-gray-400 text-sm">
          +{overflow} more
        </div>
      )}
    </div>
  );
}
