"use client";

import { useState } from "react";

interface ProductResult {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  stockQty?: number;
  image_url?: string;
}

export interface SearchProductCardProps {
  query?: string;
  results?: ProductResult[];
  onSelect?: (product: ProductResult) => void;
}

export function SearchProductCard({ query, results = [], onSelect }: SearchProductCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (product: ProductResult) => {
    setSelected(product.id);
    onSelect?.(product);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="mb-2">
        <p className="text-amber-800 font-semibold text-sm">Which one did you mean?</p>
        {query && (
          <p className="text-xs text-gray-500 mt-0.5">
            Results for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {results.length === 0 && (
        <p className="text-xs text-gray-500 italic">No matching products found.</p>
      )}

      <div className="space-y-1.5">
        {results.map((product) => (
          <button
            key={product.id}
            onClick={() => handleSelect(product)}
            className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${
              selected === product.id
                ? "bg-amber-200 border-amber-400"
                : "bg-white border-amber-100 hover:border-amber-300 hover:bg-amber-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                  <span className="text-lg opacity-30">📦</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 text-xs truncate">{product.name}</span>
                  {selected === product.id && (
                    <span className="text-amber-700 text-xs font-bold shrink-0 ml-1">✓</span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  {product.sku && (
                    <span className="text-xs text-gray-400">SKU: {product.sku}</span>
                  )}
                  {product.price !== undefined && (
                    <span className="text-xs text-gray-500">${product.price.toFixed(2)}</span>
                  )}
                  {product.stockQty !== undefined && (
                    <span className="text-xs text-gray-400">{product.stockQty} in stock</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
