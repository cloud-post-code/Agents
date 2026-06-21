interface ApprovalTagProps {
  action: "approve" | "reject";
  label?: string;
  onClick?: () => void;
  className?: string;
}

const TAG_DATA = {
  approve: { bg: "bg-green-600 hover:bg-green-700", label: "Approve" },
  reject: { bg: "bg-red-600 hover:bg-red-700", label: "Reject" },
};

export function ApprovalTag({ action, label, onClick, className }: ApprovalTagProps) {
  const { bg, label: defaultLabel } = TAG_DATA[action];
  return (
    <button
      data-approval-tag={action}
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1 rounded text-white text-sm font-medium ${bg} ${className ?? ""}`}
    >
      {label ?? defaultLabel}
    </button>
  );
}
