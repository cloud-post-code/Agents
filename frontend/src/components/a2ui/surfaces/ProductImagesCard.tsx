"use client";

import { useState } from "react";
import { apiFetch, getApiBase } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface ProductImageItem {
  url: string;
  order?: number;
}

export interface ProductImagesCardProps {
  productId: string;
  images?: ProductImageItem[];
}

export function ProductImagesCard({ productId, images: initialImages = [] }: ProductImagesCardProps) {
  const { token } = useAuth();
  const [images, setImages] = useState<ProductImageItem[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    const file = fileInput.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    try {
      // Step 1: upload file to get a URL
      const form = new FormData();
      form.append("file", file);
      const apiBase = getApiBase();
      const uploadRes = await fetch(`${apiBase}/api/v1/agent/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || "Upload failed");
      }
      const uploadData = (await uploadRes.json()) as { url: string };

      // Step 2: attach to product
      const newOrder = images.length;
      await apiFetch(`/api/v1/products/${productId}/images`, token, {
        method: "POST",
        body: JSON.stringify({ image_url: uploadData.url, image_order: newOrder }),
      });

      setImages((prev) => [...prev, { url: uploadData.url, order: newOrder }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      fileInput.value = "";
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const next = [...images];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setImages(next.map((img, i) => ({ ...img, order: i })));
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-violet-700 font-semibold">Product Images</p>
        <span className="ml-auto text-xs text-gray-400">{images.length} image{images.length !== 1 ? "s" : ""}</span>
      </div>

      {images.length === 0 && (
        <p className="text-xs text-gray-500 italic mb-3">No images yet.</p>
      )}

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Product image ${i + 1}`}
                className="w-16 h-16 object-cover rounded-lg border border-violet-100"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center gap-1 transition-opacity">
                <button
                  onClick={() => moveImage(i, -1)}
                  disabled={i === 0}
                  className="text-white text-xs bg-black/40 px-1 rounded disabled:opacity-30"
                  title="Move left"
                >
                  ←
                </button>
                <button
                  onClick={() => moveImage(i, 1)}
                  disabled={i === images.length - 1}
                  className="text-white text-xs bg-black/40 px-1 rounded disabled:opacity-30"
                  title="Move right"
                >
                  →
                </button>
              </div>
              {i === 0 && (
                <span className="absolute -top-1.5 -left-1.5 text-xs bg-violet-600 text-white px-1 rounded-full">
                  ★
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <label className={`w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed rounded-lg text-xs cursor-pointer transition-colors ${
        uploading
          ? "border-gray-200 text-gray-300 cursor-not-allowed"
          : "border-violet-300 text-violet-600 hover:bg-violet-100"
      }`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        {uploading ? "Uploading…" : "+ Upload Image"}
      </label>
    </div>
  );
}
