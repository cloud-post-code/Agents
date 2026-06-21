"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Variant {
  id: string;
  name: string;
  sku?: string;
  stockQty?: number;
  price?: number;
}

export interface VariantCardProps {
  productId: string;
  productName?: string;
  variants?: Variant[];
}

function VariantRow({
  variant,
  productId,
}: {
  variant: Variant;
  productId: string;
}) {
  const { token } = useAuth();
  const [stockQty, setStockQty] = useState(variant.stockQty ?? 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(variant.stockQty ?? 0));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(
        `/api/v1/products/${productId}/variants/${variant.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ stock_qty: parseInt(draft, 10) }),
        }
      );
      setStockQty(parseInt(draft, 10));
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-3 text-xs font-medium text-gray-800">{variant.name}</td>
      <td className="py-2 pr-3 text-xs text-gray-500">{variant.sku ?? "—"}</td>
      <td className="py-2 pr-3 text-xs text-gray-600">
        {variant.price !== undefined ? `$${variant.price.toFixed(2)}` : "—"}
      </td>
      <td className="py-2 text-xs">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-16 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(String(stockQty)); setError(null); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditing(true); setDraft(String(stockQty)); }}
            className="flex items-center gap-1 group"
          >
            <span className={stockQty <= 0 ? "text-red-500 font-semibold" : "text-gray-700"}>
              {stockQty}
            </span>
            <span className="text-gray-300 group-hover:text-blue-400 text-xs">✏</span>
            {saved && <span className="text-green-500 text-xs ml-1">✓</span>}
          </button>
        )}
        {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
      </td>
    </tr>
  );
}

export function VariantCard({ productId, productName, variants = [] }: VariantCardProps) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="mb-3">
        <p className="text-indigo-700 font-semibold">Product Variants</p>
        {productName && (
          <p className="text-xs text-gray-500 mt-0.5">{productName}</p>
        )}
      </div>

      {variants.length === 0 && (
        <p className="text-xs text-gray-500 italic">No variants for this product.</p>
      )}

      {variants.length > 0 && (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-400 font-medium pb-1.5 pr-3">Name</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-1.5 pr-3">SKU</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-1.5 pr-3">Price</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-1.5">Stock</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <VariantRow key={v.id} variant={v} productId={productId} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
