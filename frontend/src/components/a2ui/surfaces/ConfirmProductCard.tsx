"use client";

import { useState } from "react";
import { apiFetch, getApiBase } from "@/lib/api";
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
  const [quantity, setQuantity] = useState(props.quantity !== undefined ? String(props.quantity) : "");
  const [sku, setSku] = useState(props.sku ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI enhancement state
  const [activeImageUrl, setActiveImageUrl] = useState(props.image_url ?? "");
  const [showEnhance, setShowEnhance] = useState(false);
  const [scenePrompt, setScenePrompt] = useState("");
  const [imageCount, setImageCount] = useState(1);
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedImages, setEnhancedImages] = useState<string[]>([]);
  const [enhancedIndex, setEnhancedIndex] = useState(0);

  const fieldClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

  const handleEnhance = async () => {
    if (!token || !activeImageUrl) return;
    setEnhancing(true);
    setError(null);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/enhance/product-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_url: activeImageUrl,
          scene_prompt: scenePrompt || undefined,
          count: imageCount,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail || "Enhancement failed");
      }
      const data = await res.json() as { enhanced_urls: string[] };
      setEnhancedImages(data.enhanced_urls);
      setEnhancedIndex(0);
      if (data.enhanced_urls[0]) setActiveImageUrl(data.enhanced_urls[0]);
      setShowEnhance(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  };

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
        ...(activeImageUrl ? { image_url: activeImageUrl } : {}),
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

      {/* Product image — full, uncropped */}
      {activeImageUrl && (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImageUrl}
            alt={name || "Product image"}
            className="w-full object-contain bg-gray-50 rounded-xl"
          />

          {/* Thumbnail strip if multiple enhanced images */}
          {enhancedImages.length > 1 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
              {enhancedImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveImageUrl(url); setEnhancedIndex(i); }}
                  className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                    enhancedIndex === i ? "border-blue-500" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Enhanced ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* AI Enhance button */}
          {!showEnhance && (
            <button
              type="button"
              onClick={() => setShowEnhance(true)}
              className="mt-2 w-full py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              ✨ AI Enhance Image
            </button>
          )}

          {/* Enhance panel */}
          {showEnhance && (
            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-purple-700">AI Photo Enhancement</p>
              <p className="text-xs text-gray-500">
                The AI will place your product into a professional scene. Describe the environment or leave blank for a clean studio look.
              </p>
              <textarea
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                rows={2}
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                placeholder="e.g. rustic wooden table with autumn leaves, soft morning light"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">Images:</label>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setImageCount(n)}
                    className={`w-7 h-7 text-xs rounded-full border font-medium transition-colors ${
                      imageCount === n
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-purple-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={enhancing}
                  className="flex-1 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {enhancing ? "Generating…" : `Generate ${imageCount} Image${imageCount > 1 ? "s" : ""}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnhance(false)}
                  className="px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Product name</label>
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Description</label>
          <textarea className={fieldClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description" />
        </div>

        {props.variants && props.variants.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Detected variants ({props.variants.length})</label>
            <ul className="space-y-1">
              {props.variants.map((v, i) => (
                <li key={i} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-gray-700">
                  {v.name}{v.sku && <span className="ml-2 text-gray-400 font-mono">({v.sku})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Price <span className="text-red-400">*</span></label>
            <input className={fieldClass} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Quantity <span className="text-red-400">*</span></label>
            <input className={fieldClass} type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">SKU (optional)</label>
            <button type="button" onClick={() => setSku(Math.random().toString(36).slice(2, 8).toUpperCase())} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
              auto-generate
            </button>
          </div>
          <input className={fieldClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PROD-001" />
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
