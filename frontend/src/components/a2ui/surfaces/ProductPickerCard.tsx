"use client";

import { useState } from "react";

export interface ProductPickerItem {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  stock_qty?: number;
  image_url?: string;
  description?: string;
}

export interface ProductPickerCardProps {
  query?: string;
  results?: ProductPickerItem[];
  onSelect?: (product: ProductPickerItem) => void;
}

export function ProductPickerCard({ query, results = [], onSelect }: ProductPickerCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (product: ProductPickerItem) => {
    if (selected) return; // prevent double-select
    setSelected(product.id);
    onSelect?.(product);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 w-full max-w-md text-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-100">
        <p className="font-semibold text-amber-900">Which product did you mean?</p>
        {query && (
          <p className="text-xs text-amber-600 mt-0.5">
            Showing closest matches for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {results.length === 0 ? (
        <p className="px-4 py-5 text-xs text-gray-400 italic text-center">
          No matching products found.
        </p>
      ) : (
        <ul className="divide-y divide-amber-100">
          {results.slice(0, 5).map((product) => {
            const isChosen = selected === product.id;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(product)}
                  disabled={!!selected}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                    isChosen
                      ? "bg-amber-200"
                      : selected
                      ? "opacity-50 cursor-default"
                      : "hover:bg-amber-100 cursor-pointer"
                  }`}
                >
                  {/* Thumbnail */}
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-amber-100 shrink-0 flex items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800 truncate">{product.name}</span>
                      {isChosen && (
                        <span className="shrink-0 text-amber-700 font-bold text-xs bg-amber-300 px-1.5 py-0.5 rounded-full">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{product.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {product.sku && (
                        <span className="text-xs text-gray-400 font-mono">SKU: {product.sku}</span>
                      )}
                      {product.price !== undefined && (
                        <span className="text-xs font-semibold text-gray-700">
                          ${product.price.toFixed(2)}
                        </span>
                      )}
                      {product.stock_qty !== undefined && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          product.stock_qty === 0
                            ? "bg-red-100 text-red-600"
                            : product.stock_qty <= 5
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {product.stock_qty === 0 ? "Out of stock" : `${product.stock_qty} in stock`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {!selected && (
                    <span className="text-amber-400 shrink-0 text-base">›</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
