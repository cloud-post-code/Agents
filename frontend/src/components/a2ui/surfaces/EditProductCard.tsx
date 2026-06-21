"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface EditProductCardProps {
  id: string;
  name?: string;
  sku?: string;
  price?: number;
  stockQty?: number;
  description?: string;
  tags?: string[];
}

export function EditProductCard(props: EditProductCardProps) {
  const { token } = useAuth();
  const [name, setName] = useState(props.name ?? "");
  const [sku, setSku] = useState(props.sku ?? "");
  const [price, setPrice] = useState(props.price !== undefined ? String(props.price) : "");
  const [stockQty, setStockQty] = useState(props.stockQty !== undefined ? String(props.stockQty) : "");
  const [description, setDescription] = useState(props.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (name) body.name = name;
      if (sku) body.sku = sku;
      if (price !== "") body.price = parseFloat(price);
      if (description) body.description = description;
      await apiFetch(`/api/v1/products/${props.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:bg-gray-50";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-700 font-semibold">{saved ? "✓ Saved" : "Edit Product"}</span>
        {!saved && (
          <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
            {props.id.slice(0, 8)}
          </span>
        )}
      </div>

      {!saved && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Product Name</label>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-0.5">SKU</label>
              <input className={fieldClass} value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-0.5">Price ($)</label>
              <input
                className={fieldClass}
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Stock Qty</label>
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              disabled
              title="Adjust stock using the stock adjustment endpoint"
            />
            <p className="text-xs text-gray-400 mt-0.5">Adjust via stock adjustment</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Description</label>
            <textarea
              className={`${fieldClass} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {saved && (
        <p className="text-xs text-blue-600 text-center font-medium">Product updated ✓</p>
      )}
    </div>
  );
}
