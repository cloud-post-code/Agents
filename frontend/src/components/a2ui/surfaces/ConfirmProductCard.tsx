"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface VariantItem {
  name: string;
  sku?: string;
}

export interface ConfirmProductCardProps {
  image_url?: string;
  name?: string;
  description?: string;
  variants?: VariantItem[];
  price?: number;
  quantity?: number;
  sku?: string;
}

export function ConfirmProductCard(props: ConfirmProductCardProps) {
  const { token } = useAuth();
  const [name, setName] = useState(props.name ?? "");
  const [description, setDescription] = useState(props.description ?? "");
  const [price, setPrice] = useState(props.price !== undefined ? String(props.price) : "");
  const [quantity, setQuantity] = useState(
    props.quantity !== undefined ? String(props.quantity) : ""
  );
  const [sku, setSku] = useState(props.sku ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

  const handleSave = async () => {
    if (!token) return;
    if (!price || !quantity) {
      setError("Price and quantity are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name || "Unnamed Product",
        description: description || undefined,
        price: parseFloat(price),
        stock_qty: parseInt(quantity, 10),
        ...(sku ? { sku } : {}),
        ...(props.image_url ? { image_url: props.image_url } : {}),
      };
      await apiFetch("/api/v1/products", token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm w-full max-w-sm">
        <p className="text-green-700 font-semibold">✓ Added to catalog!</p>
        <p className="text-xs text-gray-500 mt-1">{name || "Product"} has been saved.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm w-full max-w-sm">
      <p className="text-blue-700 font-semibold mb-3">Confirm Product</p>

      {props.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.image_url}
          alt={name || "Product image"}
          className="w-full max-h-48 object-cover rounded-xl mb-3"
        />
      )}

      <div className="space-y-2.5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Product name</label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Description</label>
          <textarea
            className={fieldClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product description"
          />
        </div>

        {props.variants && props.variants.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Detected variants ({props.variants.length})
            </label>
            <ul className="space-y-1">
              {props.variants.map((v, i) => (
                <li
                  key={i}
                  className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-gray-700"
                >
                  {v.name}
                  {v.sku && (
                    <span className="ml-2 text-gray-400 font-mono">({v.sku})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">
              Price <span className="text-red-400">*</span>
            </label>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">
              Quantity <span className="text-red-400">*</span>
            </label>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">SKU (optional)</label>
          <input
            className={fieldClass}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g. PROD-001"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !price || !quantity}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save to Catalog"}
        </button>
      </div>
    </div>
  );
}
