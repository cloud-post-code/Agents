"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface VariantRow {
  name: string;
  sku: string;
  price: string;
  quantity: string;
}

export interface VariantConfirmCardProps {
  image_urls?: string[];
  name?: string;
  description?: string;
  variants?: { name: string; sku?: string }[];
  base_price?: number;
  quantity_per_variant?: number;
}

const fieldClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

const cellClass =
  "border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full";

export function VariantConfirmCard(props: VariantConfirmCardProps) {
  const { token } = useAuth();

  const [imageIndex, setImageIndex] = useState(0);
  const [name, setName] = useState(props.name ?? "");
  const [description, setDescription] = useState(props.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPrice =
    props.base_price !== undefined ? String(props.base_price) : "";
  const defaultQty =
    props.quantity_per_variant !== undefined
      ? String(props.quantity_per_variant)
      : "";

  const [rows, setRows] = useState<VariantRow[]>(() => {
    const initial = props.variants ?? [];
    if (initial.length > 0) {
      return initial.map((v) => ({
        name: v.name,
        sku: v.sku ?? "",
        price: defaultPrice,
        quantity: defaultQty,
      }));
    }
    return [{ name: "", sku: "", price: defaultPrice, quantity: defaultQty }];
  });

  const images = props.image_urls ?? [];

  const updateRow = (index: number, field: keyof VariantRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { name: "", sku: "", price: defaultPrice, quantity: defaultQty },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!token) return;

    if (!name) {
      setError("Product name is required.");
      return;
    }

    const missingRow = rows.findIndex((r) => !r.name || !r.price || !r.quantity);
    if (missingRow !== -1) {
      setError(`Row ${missingRow + 1} is missing name, price, or quantity.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const baseBody: Record<string, unknown> = {
        name: name || "Unnamed Product",
        description: description || undefined,
        price: parseFloat(rows[0].price),
        stock_qty: parseInt(rows[0].quantity, 10),
        ...(images.length > 0 ? { image_url: images[0] } : {}),
      };

      const product = await apiFetch<{ id: string }>(
        "/api/v1/products",
        token,
        { method: "POST", body: JSON.stringify(baseBody) }
      );

      for (const row of rows) {
        const variantBody: Record<string, unknown> = {
          name: row.name,
          price: parseFloat(row.price),
          stock_qty: parseInt(row.quantity, 10),
          ...(row.sku ? { sku: row.sku } : {}),
        };
        await apiFetch(`/api/v1/products/${product.id}/variants`, token, {
          method: "POST",
          body: JSON.stringify(variantBody),
        });
      }

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
        <p className="text-green-700 font-semibold">✓ Product with variants added!</p>
        <p className="text-xs text-gray-500 mt-1">
          {name} with {rows.length} variant{rows.length !== 1 ? "s" : ""} saved.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm w-full max-w-sm">
      <p className="text-blue-700 font-semibold mb-3">Confirm Product with Variants</p>

      {images.length > 0 && (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[imageIndex]}
            alt={name || "Product image"}
            className="w-full object-contain max-h-72 bg-gray-50 rounded-xl"
          />
          {images.length > 1 && (
            <div className="flex gap-1.5 mt-2 justify-center">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === imageIndex ? "bg-blue-500" : "bg-gray-300"
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
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
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product description"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-500">Variants</label>
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              + Add variant
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pb-1 pr-1 font-medium">Name</th>
                  <th className="text-left pb-1 pr-1 font-medium">SKU</th>
                  <th className="text-left pb-1 pr-1 font-medium">Price</th>
                  <th className="text-left pb-1 pr-1 font-medium">Qty</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody className="space-y-1">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="pr-1 pb-1">
                      <input
                        className={cellClass}
                        value={row.name}
                        onChange={(e) => updateRow(i, "name", e.target.value)}
                        placeholder="Name"
                      />
                    </td>
                    <td className="pr-1 pb-1">
                      <input
                        className={cellClass}
                        value={row.sku}
                        onChange={(e) => updateRow(i, "sku", e.target.value)}
                        placeholder="Optional"
                      />
                    </td>
                    <td className="pr-1 pb-1">
                      <input
                        className={cellClass}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateRow(i, "price", e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="pr-1 pb-1">
                      <input
                        className={cellClass}
                        type="number"
                        min="0"
                        step="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, "quantity", e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className="pb-1">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-gray-300 hover:text-red-400 font-bold px-1"
                          aria-label="Remove row"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name || rows.length === 0}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : `Save Product + ${rows.length} Variant${rows.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
