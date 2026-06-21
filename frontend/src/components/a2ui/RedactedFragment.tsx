interface RedactedFragmentProps {
  label?: string;
}

export function RedactedFragment({ label = "[Data Restricted]" }: RedactedFragmentProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-400 text-xs border border-dashed border-gray-300">
      <span>🔒</span>
      <span>{label}</span>
    </div>
  );
}
