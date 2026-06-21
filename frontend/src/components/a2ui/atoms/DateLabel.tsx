interface DateLabelProps {
  date: string | Date;
  format?: "date" | "datetime" | "relative";
  className?: string;
}

export function DateLabel({ date, format = "date", className }: DateLabelProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  let label: string;

  if (format === "datetime") {
    label = d.toLocaleString();
  } else if (format === "relative") {
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    label = days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  } else {
    label = d.toLocaleDateString();
  }

  return <span className={`text-sm text-gray-500 ${className ?? ""}`}>{label}</span>;
}
