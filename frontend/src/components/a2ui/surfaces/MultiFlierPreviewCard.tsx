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
  stock_qty?: number | null;
}

interface FlierCopy {
  headline?: string;
  subheadline?: string;
  call_to_action?: string;
  promo_text?: string;
}

export interface MultiFlierPreviewCardProps {
  format?: "square" | "portrait" | "landscape";
  brand?: FlierBrand;
  products?: FlierProduct[];
  copy?: FlierCopy;
  /** AI-generated collection image from DALL-E 3 */
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

function ProductTile({ product, primaryColor, secondaryColor, textOnPrimary, textOnSecondary, fontFamily, cta }: {
  product: FlierProduct;
  primaryColor: string;
  secondaryColor: string;
  textOnPrimary: string;
  textOnSecondary: string;
  fontFamily: string;
  cta: string;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: hex2rgba(secondaryColor, 0.08), border: `1px solid ${hex2rgba(secondaryColor, 0.18)}` }}
    >
      {/* Product image */}
      <div className="aspect-square w-full relative overflow-hidden" style={{ backgroundColor: hex2rgba(secondaryColor, 0.06) }}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name ?? ""}
            className="w-full h-full object-contain"
            crossOrigin={product.image_url.startsWith("http") ? "anonymous" : undefined}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">🖼</span>
          </div>
        )}
      </div>

      {/* Product copy */}
      <div className="px-2.5 py-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-bold leading-tight line-clamp-2" style={{ color: textOnPrimary, fontFamily }}>
          {product.name}
        </p>
        {product.description && (
          <p className="text-xs opacity-60 leading-snug line-clamp-2" style={{ color: textOnPrimary, fontFamily }}>
            {product.description}
          </p>
        )}
        {product.sku && (
          <p className="text-xs opacity-40 font-mono" style={{ color: textOnPrimary }}>
            {product.sku}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1 gap-1 flex-wrap">
          {product.price != null && (
            <span className="text-xs font-bold" style={{ color: secondaryColor, fontFamily }}>
              ${product.price.toFixed(2)}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold shrink-0"
            style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}
          >
            {cta}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MultiFlierPreviewCard({
  format = "landscape",
  brand,
  products = [],
  copy,
  ai_image_url,
}: MultiFlierPreviewCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const primaryColor = brand?.primary_color || "#1a1a1a";
  const secondaryColor = brand?.secondary_color || "#ffffff";
  const fontFamily = brand?.font_family ? `'${brand.font_family}', sans-serif` : "sans-serif";
  const textOnPrimary = isLight(primaryColor) ? "#1a1a1a" : "#ffffff";
  const textOnSecondary = isLight(secondaryColor) ? "#1a1a1a" : "#ffffff";

  const headline = copy?.headline || "Our Collection";
  const subheadline = copy?.subheadline || "";
  const cta = copy?.call_to_action || "Shop Now";
  const promo = copy?.promo_text;

  // Grid columns based on product count and format
  const count = products.length;
  const cols = format === "landscape"
    ? Math.min(count, 4)
    : count <= 2 ? 2 : count <= 4 ? 2 : 3;

  const googleFontUrl = brand?.font_family
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.font_family)}:wght@${(brand.font_weights || [400, 700]).join(";")}&display=swap`
    : null;

  async function copySpec() {
    const spec = JSON.stringify({ format, brand, products, copy }, null, 2);
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
      link.download = `${(headline || "collection-flier").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      await copySpec();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full max-w-2xl">
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}

      {/* Card header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Collection Flier</span>
              <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                {count} product{count !== 1 ? "s" : ""}
              </span>
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
        <div ref={canvasRef} className="rounded-xl overflow-hidden w-full">
          {/* AI-generated flier: raw image only, no overlay */}
          {ai_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ai_image_url}
              alt="AI-generated collection flier"
              className="w-full h-auto block"
            />
          ) : (

          <div
            className="relative"
            style={{ backgroundColor: primaryColor, fontFamily }}
          >
          {/* Brand header */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              backgroundColor: hex2rgba(secondaryColor, 0.1),
              borderBottom: `1px solid ${hex2rgba(secondaryColor, 0.15)}`,
            }}
          >
            <div className="flex items-center gap-3">
              {brand?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt={brand.name} className="h-7 object-contain" crossOrigin="anonymous" />
              ) : (
                <span className="text-xs font-bold uppercase tracking-widest opacity-80" style={{ color: textOnPrimary, fontFamily }}>
                  {brand?.name || "Your Brand"}
                </span>
              )}
            </div>
            {promo && (
              <span
                className="text-xs font-bold px-3 py-1 rounded-full shadow"
                style={{ backgroundColor: secondaryColor, color: textOnSecondary, fontFamily }}
              >
                {promo}
              </span>
            )}
          </div>

          {/* Headline section */}
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-xl font-bold" style={{ color: textOnPrimary, fontFamily }}>
              {headline}
            </h2>
            {subheadline && (
              <p className="text-sm mt-0.5 opacity-70" style={{ color: textOnPrimary, fontFamily }}>
                {subheadline}
              </p>
            )}
          </div>

          {/* Product grid */}
          <div
            className="px-4 pb-5 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {products.map((p, i) => (
              <ProductTile
                key={p.id ?? i}
                product={p}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                textOnPrimary={textOnPrimary}
                textOnSecondary={textOnSecondary}
                fontFamily={fontFamily}
                cta={cta}
              />
            ))}
          </div>
          </div>

          )}
        </div>
      </div>

      {/* Palette + tip */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: primaryColor }} title={primaryColor} />
          <div className="w-5 h-5 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: secondaryColor }} title={secondaryColor} />
          <span className="text-xs text-gray-400 ml-1">{brand?.font_family || "Default font"}</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          <span className="font-semibold">Design tip:</span> Download and import into Canva, Figma, or Adobe Express for full editing control.
        </div>
      </div>
    </div>
  );
}
