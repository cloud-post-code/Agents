"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface RemoveProductCardProps {
  id: string;
  name?: string;
  sku?: string;
  image_url?: string;
}

export function RemoveProductCard({ id, name = "this product", sku, image_url }: RemoveProductCardProps) {
  const { token } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmation.trim().toLowerCase() === name.toLowerCase();

  const handleRemove = async () => {
    if (!token || !isConfirmed) return;
    setRemoving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/products/${id}`, token, { method: "DELETE" });
      setRemoved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  if (removed) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm w-full max-w-sm">
        <p className="text-gray-500 text-center text-xs">
          <span className="font-semibold text-gray-700">{name}</span> has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="mb-3">
        <p className="text-red-700 font-semibold">Remove Product</p>
        <p className="text-xs text-gray-600 mt-1">This action cannot be undone.</p>
      </div>

      <div className="bg-white rounded-lg border border-red-100 px-3 py-2 mb-3 flex items-center gap-3">
        {image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image_url} alt={name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
            <span className="text-xl opacity-30">📦</span>
          </div>
        )}
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
          {sku && <p className="text-xs text-gray-400">SKU: {sku}</p>}
          <p className="text-xs text-gray-400 font-mono">id: {id.slice(0, 8)}</p>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-1">
          Type <strong>{name}</strong> to confirm
        </label>
        <input
          className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
          placeholder={name}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button
        onClick={handleRemove}
        disabled={removing || !isConfirmed}
        className="w-full py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
      >
        {removing ? "Removing…" : "Remove Product"}
      </button>
    </div>
  );
}
