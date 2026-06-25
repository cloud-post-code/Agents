"use client";

import { useState } from "react";
import { apiFetch, getApiBase } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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
  /** Called when user triggers an action — sends a message back to the agent */
  onAction?: (message: string) => void;
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Out of stock</span>;
  if (qty <= 5) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Low: {qty}</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{qty} in stock</span>;
}

function StockAdjuster({ product, onAction }: { product: ProductListItem; onAction?: (msg: string) => void }) {
  const [delta, setDelta] = useState(1);
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={999}
        value={delta}
        onChange={(e) => setDelta(Math.max(1, parseInt(e.target.value) || 1))}
        className="w-12 text-xs text-center border border-gray-200 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        title="Quantity"
      />
      <button
        onClick={() => onAction?.(`Increase stock ${product.id} by ${delta}`)}
        className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium transition-colors"
        title={`Add ${delta} to stock`}
      >
        +
      </button>
      <button
        onClick={() => onAction?.(`Decrease stock ${product.id} by ${delta}`)}
        className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-medium transition-colors"
        title={`Remove ${delta} from stock`}
      >
        −
      </button>
    </div>
  );
}

export function ProductListCard({
  products: initialProducts,
  total: initialTotal,
  page,
  per_page,
  onPageChange,
  onAction,
}: ProductListCardProps) {
  const { token } = useAuth();
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / per_page));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const handleDelete = async (p: ProductListItem) => {
    if (!token) return;
    setDeletingId(p.id);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/products/${p.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setProducts((prev) => prev.filter((x) => x.id !== p.id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // silently ignore — product stays in list
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white text-sm w-full max-w-2xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-800">Product Catalog</p>
        <p className="text-xs text-gray-400 mt-0.5">{total} product{total !== 1 ? "s" : ""} total</p>
      </div>

      <ul className="divide-y divide-gray-100">
        {products.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-gray-400">No products found.</li>
        )}
        {products.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                  <span className="text-gray-300 text-lg">📦</span>
                </div>
              )}

              {/* Info */}
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
                    <span className="text-xs font-semibold text-gray-700">${p.price.toFixed(2)}</span>
                  )}
                  <StockBadge qty={p.stock_qty} />
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Stock adjuster */}
                  <StockAdjuster product={p} onAction={onAction} />

                  {/* Edit */}
                  <button
                    onClick={() => onAction?.(`Edit product ${p.id}`)}
                    className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium transition-colors"
                  >
                    Edit
                  </button>

                  {/* Delete — calls API directly, removes from list instantly */}
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    className="text-xs px-2.5 py-1 rounded-md bg-gray-50 text-red-600 border border-red-200 hover:bg-red-50 font-medium transition-colors disabled:opacity-40"
                  >
                    {deletingId === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
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
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
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
