"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { SocialPostPreviewCard } from "./SocialPostPreviewCard";
import { FlierPreviewCard } from "./FlierPreviewCard";

interface Product {
  id: string;
  name: string;
  price?: number;
  image_url?: string;
  description?: string;
}

interface PostEntry {
  platform: string;
  platform_label: string;
  caption: string;
}

type Tab = "posts" | "flier";

const PLATFORMS = [
  { id: "instagram",  label: "Instagram", icon: "📸" },
  { id: "facebook",   label: "Facebook",  icon: "💙" },
  { id: "tiktok",     label: "TikTok",    icon: "🎵" },
  { id: "twitter",    label: "X",         icon: "🐦" },
  { id: "pinterest",  label: "Pinterest", icon: "📌" },
];

const FLIER_FORMATS = [
  { id: "square",    label: "Square",    desc: "1080 × 1080" },
  { id: "portrait",  label: "Portrait",  desc: "1080 × 1350" },
  { id: "landscape", label: "Landscape", desc: "1200 × 628"  },
] as const;

export interface MarketingStudioCardProps {
  /** Agent can pre-select a product by ID */
  product_id?: string;
  /** Agent can pre-select a tab */
  initial_tab?: Tab;
  /** Agent can pre-fill platform selection */
  platforms?: string[];
  /** Agent can pre-fill a creative brief */
  creative_brief?: string;
}

export function MarketingStudioCard({
  product_id,
  initial_tab = "posts",
  platforms: initialPlatforms,
  creative_brief: initialBrief = "",
}: MarketingStudioCardProps) {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>(initial_tab);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Posts state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initialPlatforms ?? ["instagram", "facebook", "tiktok"]
  );
  const [creativeBrief, setCreativeBrief] = useState(initialBrief);
  const [generatedPosts, setGeneratedPosts] = useState<PostEntry[] | null>(null);
  const [generatingPosts, setGeneratingPosts] = useState(false);

  // Flier state
  const [flierFormat, setFlierFormat] = useState<"square" | "portrait" | "landscape">("square");
  const [flierHeadline, setFlierHeadline] = useState("");
  const [flierCTA, setFlierCTA] = useState("Shop Now");
  const [flierPromo, setFlierPromo] = useState("");
  const [generatedFlier, setGeneratedFlier] = useState<Record<string, unknown> | null>(null);
  const [generatingFlier, setGeneratingFlier] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ items: Product[] }>("/api/v1/products?limit=100", token)
      .then((data) => {
        const items = data.items || [];
        setProducts(items);
        if (product_id) {
          const pre = items.find((p) => p.id === product_id);
          if (pre) setSelectedProduct(pre);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, product_id]);

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function generatePosts() {
    if (!selectedProduct || selectedPlatforms.length === 0 || !token) return;
    setGeneratingPosts(true);
    setGeneratedPosts(null);
    try {
      const data = await apiFetch<{ posts: PostEntry[] }>(
        "/api/v1/marketing/social-post/batch",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            product_id: selectedProduct.id,
            platforms: selectedPlatforms,
            post_type: "feed_post",
            creative_brief: creativeBrief,
          }),
        }
      );
      setGeneratedPosts(data.posts || []);
    } finally {
      setGeneratingPosts(false);
    }
  }

  async function generateFlier() {
    if (!selectedProduct || !token) return;
    setGeneratingFlier(true);
    setGeneratedFlier(null);
    try {
      const data = await apiFetch<Record<string, unknown>>(
        "/api/v1/marketing/flier",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            product_id: selectedProduct.id,
            headline: flierHeadline,
            call_to_action: flierCTA,
            promo_text: flierPromo,
            format: flierFormat,
          }),
        }
      );
      setGeneratedFlier(data);
    } finally {
      setGeneratingFlier(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Marketing Studio</p>
            <p className="text-xs text-gray-500 mt-0.5">Create posts and fliers for your products</p>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-rose-100/60 rounded-xl p-1">
            {(["posts", "flier"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  tab === t
                    ? "bg-white text-rose-700 shadow-sm"
                    : "text-rose-500 hover:text-rose-700"
                }`}
              >
                {t === "posts" ? "📱 Posts" : "🖼 Flier"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Product selector */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Product</p>
          {loadingProducts ? (
            <div className="text-xs text-gray-400 animate-pulse">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="text-xs text-gray-400">No products yet. Add some in Inventory first.</div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    selectedProduct?.id === p.id
                      ? "bg-rose-500 border-rose-500 text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:border-rose-300"
                  }`}
                >
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Posts tab */}
        {tab === "posts" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Platforms</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => togglePlatform(pl.id)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      selectedPlatforms.includes(pl.id)
                        ? "bg-rose-500 border-rose-500 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-rose-300"
                    }`}
                  >
                    {pl.icon} {pl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">
                Creative brief <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={creativeBrief}
                onChange={(e) => setCreativeBrief(e.target.value)}
                placeholder="e.g. Highlight the handmade quality, mention our 20% sale this week…"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300 resize-none"
              />
            </div>

            <button
              onClick={generatePosts}
              disabled={!selectedProduct || selectedPlatforms.length === 0 || generatingPosts}
              className="w-full py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingPosts ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Writing captions…
                </span>
              ) : "Generate Posts"}
            </button>

            {generatedPosts && (
              <SocialPostPreviewCard
                posts={generatedPosts}
                product_name={selectedProduct?.name}
                product_image_url={selectedProduct?.image_url}
              />
            )}
          </div>
        )}

        {/* Flier tab */}
        {tab === "flier" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Format</p>
              <div className="flex gap-2">
                {FLIER_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFlierFormat(f.id)}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      flierFormat === f.id
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-semibold">{f.label}</span>
                    <span className="text-gray-400 font-normal">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Headline</label>
                <input
                  value={flierHeadline}
                  onChange={(e) => setFlierHeadline(e.target.value)}
                  placeholder="Defaults to product name"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">Call to Action</label>
                <input
                  value={flierCTA}
                  onChange={(e) => setFlierCTA(e.target.value)}
                  placeholder="Shop Now"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1 block">
                Promo banner <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={flierPromo}
                onChange={(e) => setFlierPromo(e.target.value)}
                placeholder="e.g. LIMITED TIME · 20% OFF"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300"
              />
            </div>

            <button
              onClick={generateFlier}
              disabled={!selectedProduct || generatingFlier}
              className="w-full py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingFlier ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Building flier…
                </span>
              ) : "Generate Flier"}
            </button>

            {generatedFlier && (
              <FlierPreviewCard {...(generatedFlier as Parameters<typeof FlierPreviewCard>[0])} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
