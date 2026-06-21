import React from "react";

interface TableProps {
  headers?: string[];
  children: React.ReactNode;
  className?: string;
}

export function Table({ headers, children, className }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className ?? ""}`}>
      <table className="w-full text-left text-sm">
        {headers && (
          <thead>
            <tr className="border-b">
              {headers.map((h) => (
                <th key={h} className="pb-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}
