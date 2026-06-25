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
  /** AI-generated marketing image from DALL-E 3 — shown full-bleed behind the copy */
  ai_image_url?: string | null;
}

function hex2rgba(hex: string, alpha = 1): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isLight(hex: string): boolean {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function FlierPreviewCard({
  format = "square",
  brand,
  product,
  copy,
  ai_image_url,
}: FlierPreviewCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const primaryColor = brand?.primary_color || "#1a1a1a";
  const secondaryColor = brand?.secondary_color || "#ffffff";
  const fontFamily = brand?.font_family ? `'${brand.font_family}', sans-serif` : "sans-serif";
  const textOnPrimary = isLight(primaryColor) ? "#1a1a1a" : "#ffffff";
  const textOnSecondary = isLight(secondaryColor) ? "#1a1a1a" : "#ffffff";
  const accentOnPrimary = isLight(primaryColor) ? hex2rgba("#000000", 0.12) : hex2rgba("#ffffff", 0.12);

  const headline = copy?.headline || product?.name || "Your Product";
  const subheadline = copy?.subheadline || product?.description?.slice(0, 120) || "";
  const cta = copy?.call_to_action || "Shop Now";
  const promo = copy?.promo_text;
  const price = product?.price;
  // AI-generated image takes priority; fall back to product photo
  const imageUrl = ai_image_url || product?.image_url;

  // Portrait is taller so use a bigger image box; landscape uses a side-by-side
  const isLandscape = format === "landscape";

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
      await copySpec();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full max-w-xl">
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}

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

      {/* AI image badge */}
      {ai_image_url && (
        <div className="px-5 pb-0 pt-2">
          <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
            ✨ AI-generated image
          </span>
        </div>
      )}

      {/* Flier canvas */}
      <div className="p-4">
        <div
          ref={canvasRef}
          style={{ backgroundColor: primaryColor, fontFamily }}
          className="rounded-xl overflow-hidden w-full"
        >
          {/* ── AI full-bleed poster layout (when DALL-E image is available) ── */}
          {ai_image_url ? (
            <div className={`relative ${format === "landscape" ? "" : format === "portrait" ? "aspect-[4/5]" : "aspect-square"}`}
              style={format === "landscape" ? { minHeight: 320 } : {}}>
              {/* Full-bleed AI image — data URI, no crossOrigin needed */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ai_image_url}
                alt="AI-generated flier"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient overlay for text legibility */}
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to bottom, ${hex2rgba(primaryColor, 0.15)} 0%, transparent 40%, ${hex2rgba(primaryColor, 0.75)} 70%, ${hex2rgba(primaryColor, 0.95)} 100%)` }}
              />
              {/* Brand top-left */}
              <div className="absolute top-4 left-4 z-10">
                {brand?.logo_url ? (
                  <img src={brand.logo_url} alt={brand?.name} className="h-8 object-contain drop-shadow" crossOrigin="anonymous" />
                ) : (
                  <span className="text-xs font-bold uppercase tracking-widest drop-shadow" style={{ color: textOnPrimary, fontFamily }}>
                    {brand?.name || "Your Brand"}
                  </span>
                )}
              </div>
              {/* Promo badge top-right */}
              {promo && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full shadow-lg" style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}>
                    {promo}
                  </span>
                </div>
              )}
              {/* Copy bottom */}
              <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5">
                {price != null && (
                  <div className="text-sm font-bold mb-1 opacity-90" style={{ color: secondaryColor, fontFamily }}>${price.toFixed(2)}</div>
                )}
                <h2 className="text-2xl font-bold leading-tight mb-1.5 drop-shadow" style={{ color: textOnPrimary, fontFamily }}>{headline}</h2>
                {subheadline && (
                  <p className="text-sm leading-snug mb-4 opacity-85 drop-shadow" style={{ color: textOnPrimary, fontFamily }}>{subheadline}</p>
                )}
                <span className="inline-block px-5 py-2.5 rounded-full text-sm font-bold shadow-md" style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}>{cta}</span>
              </div>
            </div>
          ) : isLandscape ? (
            /* ── Landscape: side-by-side image + copy ── */
            <div className="flex" style={{ minHeight: 300 }}>
              {/* Left: product image */}
              <div className="w-2/5 shrink-0 relative" style={{ backgroundColor: accentOnPrimary }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product?.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: hex2rgba(secondaryColor, 0.08) }}
                  >
                    <span className="text-4xl opacity-30">🖼</span>
                  </div>
                )}
              </div>

              {/* Right: copy */}
              <div className="flex-1 flex flex-col justify-between p-6">
                {/* Brand */}
                <div className="flex items-center justify-between mb-4">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name} className="h-7 object-contain" crossOrigin="anonymous" />
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70" style={{ color: textOnPrimary }}>
                      {brand?.name || "Your Brand"}
                    </span>
                  )}
                  {promo && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: secondaryColor, color: textOnSecondary }}
                    >
                      {promo}
                    </span>
                  )}
                </div>

                {/* Copy */}
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-xl font-bold leading-tight mb-2" style={{ color: textOnPrimary }}>
                    {headline}
                  </h2>
                  {subheadline && (
                    <p className="text-sm leading-snug mb-3 opacity-75" style={{ color: textOnPrimary }}>
                      {subheadline}
                    </p>
                  )}
                </div>

                {/* Price + CTA */}
                <div className="flex items-center gap-3 mt-4">
                  {price != null && (
                    <span className="text-lg font-bold" style={{ color: secondaryColor }}>
                      ${price.toFixed(2)}
                    </span>
                  )}
                  <span
                    className="px-4 py-2 rounded-full text-xs font-bold shadow"
                    style={{ backgroundColor: secondaryColor, color: textOnSecondary }}
                  >
                    {cta}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ── Square / Portrait: stacked layout ── */
            <div className="flex flex-col">
              {/* Brand header bar */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ backgroundColor: hex2rgba(secondaryColor, 0.1), borderBottom: `1px solid ${hex2rgba(secondaryColor, 0.15)}` }}
              >
                {brand?.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-7 object-contain" crossOrigin="anonymous" />
                ) : (
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80" style={{ color: textOnPrimary, fontFamily }}>
                    {brand?.name || "Your Brand"}
                  </span>
                )}
                {promo && (
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full shadow"
                    style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}
                  >
                    {promo}
                  </span>
                )}
              </div>

              {/* Product image — distinct featured section, not a background */}
              <div
                className="w-full relative"
                style={{
                  aspectRatio: format === "portrait" ? "4/3" : "1/1",
                  backgroundColor: hex2rgba(secondaryColor, 0.06),
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product?.name}
                    className="w-full h-full object-contain"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl opacity-20">🖼</span>
                  </div>
                )}
              </div>

              {/* Copy section below image */}
              <div className="px-5 py-4 flex flex-col gap-2">
                <h2 className="text-xl font-bold leading-tight" style={{ color: textOnPrimary, fontFamily }}>
                  {headline}
                </h2>
                {subheadline && (
                  <p className="text-sm leading-snug opacity-75" style={{ color: textOnPrimary, fontFamily }}>
                    {subheadline}
                  </p>
                )}

                {/* Price + CTA row */}
                <div className="flex items-center gap-3 mt-2">
                  {price != null && (
                    <span className="text-lg font-bold" style={{ color: secondaryColor, fontFamily }}>
                      ${price.toFixed(2)}
                    </span>
                  )}
                  <span
                    className="px-5 py-2 rounded-full text-sm font-bold shadow"
                    style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}
                  >
                    {cta}
                  </span>
                </div>
              </div>
            </div>
          ) /* end non-AI layouts */}
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
