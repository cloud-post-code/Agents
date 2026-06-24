"use client";

import { useState, useRef } from "react";
import { apiFetch, getApiBase } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface BulkProduct {
  id: string; // local temp id
  name: string;
  description: string;
  price: string;
  quantity: string;
  sku: string;
  image_url?: string;
  imageFile?: File;
  uploading?: boolean;
  saved?: boolean;
  error?: string;
}

export interface BulkListingCardProps {
  // Optional pre-filled products from agent extraction
  products?: Array<{
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    sku?: string;
    image_url?: string;
  }>;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const emptyRow = (): BulkProduct => ({
  id: uid(), name: "", description: "", price: "", quantity: "", sku: "",
});

export function BulkListingCard({ products: initialProducts }: BulkListingCardProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkProduct[]>(() => {
    if (initialProducts?.length) {
      return initialProducts.map((p) => ({
        id: uid(),
        name: p.name ?? "",
        description: p.description ?? "",
        price: p.price !== undefined ? String(p.price) : "",
        quantity: p.quantity !== undefined ? String(p.quantity) : "",
        sku: p.sku ?? "",
        image_url: p.image_url,
      }));
    }
    return [emptyRow(), emptyRow(), emptyRow()];
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const update = (id: string, field: keyof BulkProduct, value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleImageClick = (id: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.dataset.targetId = id;
    fileInputRef.current.click();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = e.target.dataset.targetId;
    if (!file || !targetId || !token) return;

    setRows((prev) => prev.map((r) => r.id === targetId ? { ...r, uploading: true } : r));

    try {
      const form = new FormData();
      form.append("file", file);
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/agent/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json() as { url: string };
      setRows((prev) => prev.map((r) => r.id === targetId
        ? { ...r, uploading: false, image_url: data.url, imageFile: file }
        : r
      ));
    } catch {
      setRows((prev) => prev.map((r) => r.id === targetId ? { ...r, uploading: false } : r));
    }
    e.target.value = "";
  };

  const saveAll = async () => {
    if (!token) return;
    const validRows = rows.filter((r) => r.name.trim() && r.price && r.quantity);
    if (validRows.length === 0) {
      setGlobalError("At least one product needs a name, price, and quantity.");
      return;
    }
    setSaving(true);
    setGlobalError(null);

    for (const row of validRows) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, error: undefined } : r));
      try {
        await apiFetch("/api/v1/products", token, {
          method: "POST",
          body: JSON.stringify({
            name: row.name,
            description: row.description || undefined,
            price: parseFloat(row.price),
            stock_qty: parseInt(row.quantity, 10),
            sku: row.sku || undefined,
            image_url: row.image_url || undefined,
          }),
        });
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saved: true } : r));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed";
        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, error: msg } : r));
      }
    }
    setSaving(false);
    const allSaved = rows.filter((r) => r.name).every((r) => r.saved);
    if (allSaved) setDone(true);
  };

  const savedCount = rows.filter((r) => r.saved).length;
  const validCount = rows.filter((r) => r.name.trim() && r.price && r.quantity).length;

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm w-full">
        <p className="text-green-700 font-semibold text-base">✓ {savedCount} product{savedCount > 1 ? "s" : ""} added to catalog!</p>
        <p className="text-xs text-gray-500 mt-1">You can view and edit them in your Inventory page.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white text-sm w-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Bulk Product Listing</p>
          <p className="text-xs text-gray-400 mt-0.5">Fill in your products and save them all at once</p>
        </div>
        <button
          onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
        >
          + Add row
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 text-left w-12">Photo</th>
              <th className="px-3 py-2 text-left">Name *</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left w-20">Price *</th>
              <th className="px-3 py-2 text-left w-16">Qty *</th>
              <th className="px-3 py-2 text-left w-24">SKU</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.id} className={`${row.saved ? "bg-green-50" : row.error ? "bg-red-50" : ""}`}>
                {/* Image */}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleImageClick(row.id)}
                    disabled={row.uploading || row.saved}
                    className="w-10 h-10 rounded-lg border border-dashed border-gray-200 hover:border-blue-400 overflow-hidden flex items-center justify-center bg-gray-50 shrink-0 transition-colors"
                    title="Upload photo"
                  >
                    {row.uploading ? (
                      <span className="text-gray-400 animate-pulse text-xs">…</span>
                    ) : row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-gray-300 text-base">+</span>
                    )}
                  </button>
                </td>
                {/* Name */}
                <td className="px-3 py-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-gray-50"
                    value={row.name}
                    onChange={(e) => update(row.id, "name", e.target.value)}
                    placeholder="Product name"
                    disabled={row.saved}
                  />
                </td>
                {/* Description */}
                <td className="px-3 py-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-gray-50"
                    value={row.description}
                    onChange={(e) => update(row.id, "description", e.target.value)}
                    placeholder="Optional"
                    disabled={row.saved}
                  />
                </td>
                {/* Price */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    <span className="text-gray-400">$</span>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-gray-50"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => update(row.id, "price", e.target.value)}
                      placeholder="0.00"
                      disabled={row.saved}
                    />
                  </div>
                </td>
                {/* Qty */}
                <td className="px-3 py-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-gray-50"
                    type="number"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => update(row.id, "quantity", e.target.value)}
                    placeholder="0"
                    disabled={row.saved}
                  />
                </td>
                {/* SKU */}
                <td className="px-3 py-2">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono disabled:bg-gray-50"
                    value={row.sku}
                    onChange={(e) => update(row.id, "sku", e.target.value)}
                    placeholder="Optional"
                    disabled={row.saved}
                  />
                </td>
                {/* Status / Remove */}
                <td className="px-3 py-2 text-center">
                  {row.saved ? (
                    <span className="text-green-500 font-bold">✓</span>
                  ) : row.error ? (
                    <span className="text-red-400 text-xs" title={row.error}>✕</span>
                  ) : (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-gray-300 hover:text-red-400 text-base leading-none"
                      title="Remove row"
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

      {globalError && (
        <p className="px-4 py-2 text-xs text-red-500">{globalError}</p>
      )}

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {validCount} of {rows.length} row{rows.length > 1 ? "s" : ""} ready to save
        </p>
        <button
          onClick={saveAll}
          disabled={saving || validCount === 0}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {saving ? `Saving…` : `Save ${validCount} Product${validCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
