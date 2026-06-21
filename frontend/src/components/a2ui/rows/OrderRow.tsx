import { StatusPill } from "../atoms/StatusPill";

interface OrderRowProps {
  orderId: string;
  customerName?: string;
  total?: number;
  status?: string;
  className?: string;
}

export function OrderRow({ orderId, customerName, total, status, className }: OrderRowProps) {
  return (
    <tr className={className}>
      <td className="py-2 pr-4 font-mono text-sm">{orderId}</td>
      {customerName && <td className="py-2 pr-4">{customerName}</td>}
      {total !== undefined && <td className="py-2 pr-4 font-medium">${total.toFixed(2)}</td>}
      {status && <td className="py-2"><StatusPill status={status} /></td>}
    </tr>
  );
}
