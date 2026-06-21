"use client";

interface ProductListItem {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  stock_qty: number;
  description?: string;
  image_url?: string;
}

export interface ProductListCardProps {
  products: ProductListItem[];
  total: number;
  page: number;
  per_page: number;
  onPageChange?: (page: number) => void;
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
        Out of stock
      </span>
    );
  }
  if (qty <= 5) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
        Low: {qty}
      </span>
    );
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      {qty} in stock
    </span>
  );
}

export function ProductListCard({
  products,
  total,
  page,
  per_page,
  onPageChange,
}: ProductListCardProps) {
  const totalPages = Math.max(1, Math.ceil(total / per_page));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="rounded-xl border border-gray-200 bg-white text-sm w-full max-w-lg">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-800">Product Catalog</p>
        <p className="text-xs text-gray-400 mt-0.5">{total} product{total !== 1 ? "s" : ""} total</p>
      </div>

      <ul className="divide-y divide-gray-100">
        {products.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-gray-400">
            No products found.
          </li>
        )}
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                <span className="text-gray-300 text-lg">📦</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-800 truncate">{p.name}</span>
                {p.sku && (
                  <span className="text-xs text-gray-400 font-mono shrink-0">{p.sku}</span>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{p.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {p.price !== undefined && (
                  <span className="text-xs font-semibold text-gray-700">
                    ${p.price.toFixed(2)}
                  </span>
                )}
                <StockBadge qty={p.stock_qty} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={!hasPrev || !onPageChange}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={!hasNext || !onPageChange}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
