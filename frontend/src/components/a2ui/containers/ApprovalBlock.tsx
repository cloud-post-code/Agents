import React from "react";

interface ApprovalBlockProps {
  children: React.ReactNode;
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

function hasApprovalTag(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<any>;
      if (el.props?.["data-approval-tag"] !== undefined) {
        found = true;
      }
      if (el.props?.children && hasApprovalTag(el.props.children)) {
        found = true;
      }
    }
  });
  return found;
}

export function ApprovalBlock({ children, onApprove, onReject, className }: ApprovalBlockProps) {
  const hasApproval = hasApprovalTag(children);

  if (!hasApproval) {
    // Degrade to plain table
    return (
      <div className={`overflow-x-auto ${className ?? ""}`}>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div data-approval-block className={`border rounded-lg overflow-hidden ${className ?? ""}`}>
      <div className="divide-y divide-gray-100">{children}</div>
      {(onApprove || onReject) && (
        <div className="flex gap-2 p-3 bg-gray-50 border-t">
          {onApprove && (
            <button onClick={onApprove} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
              Approve
            </button>
          )}
          {onReject && (
            <button onClick={onReject} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
