"use client";

import { useState, useRef } from "react";

interface FlierBrand {
  name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  font_weights?: number[];
}

interface FlierProduct {
  id?: string;
  name?: string;
  description?: string;
  price?: number | null;
  image_url?: string | null;
  sku?: string | null;
}

interface FlierCopy {
  headline?: string;
  subheadline?: string;
  call_to_action?: string;
  promo_text?: string;
}

interface FlierDimensions {
  width: number;
  height: number;
  ratio: string;
}

export interface FlierPreviewCardProps {
  format?: "square" | "portrait" | "landscape";
  dimensions?: FlierDimensions;
  brand?: FlierBrand;
  product?: FlierProduct;
  copy?: FlierCopy;
  style?: {
    background_style?: string;
    imagery_style?: string;
  };
}

function hex2rgba(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function FlierPreviewCard({
  format = "square",
  brand,
  product,
  copy,
}: FlierPreviewCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const primaryColor = brand?.primary_color || "#1a1a1a";
  const secondaryColor = brand?.secondary_color || "#ffffff";
  const fontFamily = brand?.font_family ? `'${brand.font_family}', sans-serif` : "sans-serif";
  const textOnPrimary = isLight(primaryColor) ? "#1a1a1a" : "#ffffff";
  const textOnSecondary = isLight(secondaryColor) ? "#1a1a1a" : "#ffffff";

  const aspectClass = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video",
  }[format];

  const headline = copy?.headline || product?.name || "Your Product";
  const subheadline = copy?.subheadline || product?.description?.slice(0, 100) || "";
  const cta = copy?.call_to_action || "Shop Now";
  const promo = copy?.promo_text;
  const price = product?.price;
  const imageUrl = product?.image_url;

  // Load Google Font if set
  const googleFontUrl = brand?.font_family
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.font_family)}:wght@${(brand.font_weights || [400, 700]).join(";")}&display=swap`
    : null;

  async function copySpec() {
    const spec = JSON.stringify({ format, brand, product, copy }, null, 2);
    await navigator.clipboard.writeText(spec);
    setShareMsg("Spec copied!");
    setTimeout(() => setShareMsg(""), 2000);
  }

  async function downloadFlier() {
    if (downloading || !canvasRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(canvasRef.current, { useCORS: true, allowTaint: true, scale: 2 });
      const link = document.createElement("a");
      link.download = `${(product?.name || "flier").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // fallback: copy spec to clipboard
      await copySpec();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full max-w-xl">
      {/* Google Font loader */}
      {googleFontUrl && (
        <link rel="stylesheet" href={googleFontUrl} />
      )}

      {/* Card header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Flier Preview</span>
              {product?.name && (
                <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                  {product.name}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {format} · {brand?.name || "Your Brand"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySpec}
              className="text-xs px-3 py-1.5 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium transition-colors"
            >
              {shareMsg || "Copy spec"}
            </button>
            <button
              onClick={downloadFlier}
              disabled={downloading}
              className="text-xs px-3 py-1.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 font-medium transition-colors disabled:opacity-60"
            >
              {downloading ? "Saving…" : "⬇ Download"}
            </button>
          </div>
        </div>
      </div>

      {/* Flier canvas */}
      <div className="p-4">
        <div
          ref={canvasRef}
          className={`relative ${aspectClass} rounded-xl overflow-hidden w-full`}
          style={{ backgroundColor: primaryColor, fontFamily }}
        >
          {/* Background product image with overlay */}
          {imageUrl && (
            <>
              <img
                src={imageUrl}
                alt={product?.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to bottom, ${hex2rgba(primaryColor, 0.35)} 0%, ${hex2rgba(primaryColor, 0.85)} 65%, ${hex2rgba(primaryColor, 0.97)} 100%)` }}
              />
            </>
          )}
          {!imageUrl && (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${hex2rgba(primaryColor, 0.85)} 100%)` }}
            />
          )}

          {/* Promo badge */}
          {promo && (
            <div className="absolute top-4 right-4 z-10">
              <div
                className="text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                style={{ backgroundColor: secondaryColor, color: textOnSecondary }}
              >
                {promo}
              </div>
            </div>
          )}

          {/* Brand logo or name */}
          <div className="absolute top-4 left-4 z-10">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="h-8 object-contain" />
            ) : (
              <div
                className="text-xs font-bold uppercase tracking-widest opacity-90"
                style={{ color: textOnPrimary, fontFamily }}
              >
                {brand?.name || "Your Brand"}
              </div>
            )}
          </div>

          {/* Main copy — bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5 pt-8">
            {price != null && (
              <div
                className="text-sm font-bold mb-1 opacity-90"
                style={{ color: secondaryColor, fontFamily }}
              >
                ${price.toFixed(2)}
              </div>
            )}
            <h2
              className="text-2xl font-bold leading-tight mb-1.5"
              style={{ color: textOnPrimary, fontFamily, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            >
              {headline}
            </h2>
            {subheadline && (
              <p
                className="text-sm leading-snug mb-4 opacity-85"
                style={{ color: textOnPrimary, fontFamily }}
              >
                {subheadline}
              </p>
            )}
            <div
              className="inline-block px-5 py-2.5 rounded-full text-sm font-bold shadow-md"
              style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}
            >
              {cta}
            </div>
          </div>
        </div>
      </div>

      {/* Color palette preview */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: primaryColor }} title={primaryColor} />
          <div className="w-5 h-5 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: secondaryColor }} title={secondaryColor} />
          <span className="text-xs text-gray-400 ml-1">{brand?.font_family || "Default font"}</span>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          <span className="font-semibold">Design tip:</span> Download this spec and import it into Canva, Figma, or Adobe Express to create the final flier with full editing control.
        </div>
      </div>
    </div>
  );
}
