"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface VariantItem {
  name: string;
}

interface MultiProductItem {
  image_urls: string[];
  name: string;
  description: string;
  variants: VariantItem[];
  price?: number;
  quantity?: number;
}

export interface MultiProductCardProps {
  products: MultiProductItem[];
}

interface ProductState {
  name: string;
  description: string;
  price: string;
  quantity: string;
  imageIndex: number;
}

const fieldClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

function MiniProductSection({
  product,
  state,
  onChange,
  index,
}: {
  product: MultiProductItem;
  state: ProductState;
  onChange: (update: Partial<ProductState>) => void;
  index: number;
}) {
  const images = product.image_urls ?? [];

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-white">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
        Product {index + 1}
      </p>

      {images.length > 0 && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[state.imageIndex]}
            alt={state.name || `Product ${index + 1}`}
            className="w-full object-contain max-h-56 bg-gray-50 rounded-xl"
          />
          {images.length > 1 && (
            <div className="flex gap-1.5 mt-2 justify-center">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ imageIndex: i })}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === state.imageIndex ? "bg-blue-500" : "bg-gray-300"
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Name</label>
        <input
          className={fieldClass}
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Product name"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Description</label>
        <textarea
          className={fieldClass}
          rows={2}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Product description"
        />
      </div>

      {product.variants.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Variants ({product.variants.length})
          </label>
          <ul className="space-y-1">
            {product.variants.map((v, vi) => (
              <li
                key={vi}
                className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-1 text-gray-700"
              >
                {v.name}
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
            value={state.price}
            onChange={(e) => onChange({ price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">
            Qty <span className="text-red-400">*</span>
          </label>
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={state.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}

export function MultiProductCard({ products }: MultiProductCardProps) {
  const { token } = useAuth();

  const [productStates, setProductStates] = useState<ProductState[]>(
    products.map((p) => ({
      name: p.name,
      description: p.description,
      price: p.price !== undefined ? String(p.price) : "",
      quantity: p.quantity !== undefined ? String(p.quantity) : "",
      imageIndex: 0,
    }))
  );

  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [allSaved, setAllSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProduct = (index: number, update: Partial<ProductState>) => {
    setProductStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...update } : s))
    );
  };

  const handleSaveAll = async () => {
    if (!token) return;

    const missing = productStates.findIndex((s) => !s.price || !s.quantity);
    if (missing !== -1) {
      setError(`Product ${missing + 1} is missing price or quantity.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSavedCount(0);

    try {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const s = productStates[i];
        const body: Record<string, unknown> = {
          name: s.name || "Unnamed Product",
          description: s.description || undefined,
          price: parseFloat(s.price),
          stock_qty: parseInt(s.quantity, 10),
          ...(p.image_urls.length > 0 ? { image_url: p.image_urls[0] } : {}),
        };
        await apiFetch("/api/v1/products", token, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSavedCount(i + 1);
      }
      setAllSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (allSaved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm w-full max-w-sm">
        <p className="text-green-700 font-semibold">
          ✓ All {products.length} products added!
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Your catalog has been updated.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm w-full max-w-sm">
      <p className="text-blue-700 font-semibold mb-3">
        Confirm {products.length} Products
      </p>

      <div className="space-y-3">
        {products.map((p, i) => (
          <MiniProductSection
            key={i}
            product={p}
            state={productStates[i]}
            onChange={(update) => updateProduct(i, update)}
            index={i}
          />
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <button
        onClick={handleSaveAll}
        disabled={saving}
        className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {saving
          ? `Saving ${savedCount + 1} of ${products.length}...`
          : `Save All ${products.length} Products`}
      </button>
    </div>
  );
}
