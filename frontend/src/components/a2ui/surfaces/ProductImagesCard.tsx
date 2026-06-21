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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (index: number) => {
    if (images.length === 0) return;
    // Loop: wrap around both ends
    setCurrentIndex((index + images.length) % images.length);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    const file = fileInput.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    try {
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

      const newOrder = images.length;
      await apiFetch(`/api/v1/products/${productId}/images`, token, {
        method: "POST",
        body: JSON.stringify({ image_url: uploadData.url, image_order: newOrder }),
      });

      setImages((prev) => {
        const next = [...prev, { url: uploadData.url, order: newOrder }];
        setCurrentIndex(next.length - 1);
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      fileInput.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-violet-700 font-semibold">Product Images</p>
        <span className="ml-auto text-xs text-gray-400">
          {images.length} image{images.length !== 1 ? "s" : ""}
        </span>
      </div>

      {images.length === 0 && (
        <p className="text-xs text-gray-500 italic mb-3">No images yet.</p>
      )}

      {images.length > 0 && (
        <div className="mb-3">
          {/* Carousel image */}
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[currentIndex].url}
              alt={`Product image ${currentIndex + 1} of ${images.length}`}
              className="w-full h-full object-cover"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={() => goTo(currentIndex - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center text-sm hover:bg-black/60 transition-colors"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  onClick={() => goTo(currentIndex + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center text-sm hover:bg-black/60 transition-colors"
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}

            {currentIndex === 0 && (
              <span className="absolute top-2 left-2 text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full">
                ★ Main
              </span>
            )}
          </div>

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? "bg-violet-600" : "bg-violet-200"
                  }`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <label
        className={`w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed rounded-lg text-xs cursor-pointer transition-colors ${
          uploading
            ? "border-gray-200 text-gray-300 cursor-not-allowed"
            : "border-violet-300 text-violet-600 hover:bg-violet-100"
        }`}
      >
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
