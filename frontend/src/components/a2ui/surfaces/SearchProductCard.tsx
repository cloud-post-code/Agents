"use client";

import { useState } from "react";

interface ProductResult {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  stockQty?: number;
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
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800 text-xs">{product.name}</span>
              {selected === product.id && (
                <span className="text-amber-700 text-xs font-bold">✓</span>
              )}
            </div>
            <div className="flex gap-3 mt-0.5">
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
          </button>
        ))}
      </div>
    </div>
  );
}
