"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { SocialPostPreviewCard } from "@/components/a2ui/surfaces/SocialPostPreviewCard";
import { FlierPreviewCard } from "@/components/a2ui/surfaces/FlierPreviewCard";

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

type ActiveTool = "posts" | "flier" | null;

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "facebook", label: "Facebook", icon: "💙" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "twitter", label: "X (Twitter)", icon: "🐦" },
  { id: "pinterest", label: "Pinterest", icon: "📌" },
];

const FLIER_FORMATS = [
  { id: "square", label: "Square", desc: "1080 × 1080 · Instagram / Facebook" },
  { id: "portrait", label: "Portrait", desc: "1080 × 1350 · Instagram Story / Feed" },
  { id: "landscape", label: "Landscape", desc: "1200 × 628 · Facebook Ad / LinkedIn" },
];

interface ProductsResponse {
  items: Product[];
}

interface BatchPostsResponse {
  posts: PostEntry[];
}

export default function MarketingPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  // Post state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook", "tiktok"]);
  const [creativeBrief, setCreativeBrief] = useState("");
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
    apiFetch<ProductsResponse>("/api/v1/products?limit=50", token)
      .then((data) => setProducts(data.items || []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [token]);

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function generatePosts() {
    if (!selectedProduct || selectedPlatforms.length === 0 || !token) return;
    setGeneratingPosts(true);
    setGeneratedPosts(null);
    try {
      const data = await apiFetch<BatchPostsResponse>("/api/v1/marketing/social-post/batch", token, {
        method: "POST",
        body: JSON.stringify({
          product_id: selectedProduct.id,
          platforms: selectedPlatforms,
          post_type: "feed_post",
          creative_brief: creativeBrief,
        }),
      });
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
      const data = await apiFetch<Record<string, unknown>>("/api/v1/marketing/flier", token, {
        method: "POST",
        body: JSON.stringify({
          product_id: selectedProduct.id,
          headline: flierHeadline,
          call_to_action: flierCTA,
          promo_text: flierPromo,
          format: flierFormat,
        }),
      });
      setGeneratedFlier(data);
    } finally {
      setGeneratingFlier(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marketing Studio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create on-brand social posts and fliers for your products in seconds.
        </p>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-2 gap-3">
        <ToolCard
          icon="📱"
          title="Social Posts"
          description="Generate captions for Instagram, Facebook, TikTok, and more"
          active={activeTool === "posts"}
          onClick={() => { setActiveTool("posts"); setGeneratedPosts(null); }}
          color="rose"
        />
        <ToolCard
          icon="🖼"
          title="Fliers"
          description="Create a branded product flier with your colors and fonts"
          active={activeTool === "flier"}
          onClick={() => { setActiveTool("flier"); setGeneratedFlier(null); }}
          color="purple"
        />
      </div>

      {activeTool && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left panel — inputs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Product picker */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Select a product</h3>
              {loadingProducts ? (
                <div className="text-xs text-gray-400 animate-pulse">Loading products…</div>
              ) : products.length === 0 ? (
                <div className="text-xs text-gray-400">No products yet. Add some in Inventory first.</div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        selectedProduct?.id === p.id
                          ? "bg-rose-50 border border-rose-200"
                          : "bg-gray-50 border border-transparent hover:border-gray-200"
                      }`}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-lg flex-shrink-0">📦</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                        {p.price && <div className="text-xs text-gray-500">${p.price.toFixed(2)}</div>}
                      </div>
                      {selectedProduct?.id === p.id && (
                        <span className="ml-auto text-rose-500 text-sm">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Posts config */}
            {activeTool === "posts" && (
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Platforms</h3>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => togglePlatform(pl.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        selectedPlatforms.includes(pl.id)
                          ? "bg-rose-500 border-rose-500 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                      }`}
                    >
                      <span>{pl.icon}</span>{pl.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Creative brief (optional)</label>
                  <textarea
                    value={creativeBrief}
                    onChange={(e) => setCreativeBrief(e.target.value)}
                    placeholder="e.g. Highlight the handmade quality, mention our 20% sale this week…"
                    rows={3}
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
              </div>
            )}

            {/* Flier config */}
            {activeTool === "flier" && (
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Flier settings</h3>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Format</label>
                  <div className="space-y-1.5">
                    {FLIER_FORMATS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFlierFormat(f.id as typeof flierFormat)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors ${
                          flierFormat === f.id
                            ? "bg-purple-50 border-purple-300"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`text-xs font-semibold ${flierFormat === f.id ? "text-purple-700" : "text-gray-700"}`}>{f.label}</div>
                        <div className="text-xs text-gray-400">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Headline</label>
                  <input
                    value={flierHeadline}
                    onChange={(e) => setFlierHeadline(e.target.value)}
                    placeholder="Defaults to product name"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Call to Action</label>
                  <input
                    value={flierCTA}
                    onChange={(e) => setFlierCTA(e.target.value)}
                    placeholder="Shop Now"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Promo banner (optional)</label>
                  <input
                    value={flierPromo}
                    onChange={(e) => setFlierPromo(e.target.value)}
                    placeholder="e.g. LIMITED TIME · 20% OFF"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                </div>
                <button
                  onClick={generateFlier}
                  disabled={!selectedProduct || generatingFlier}
                  className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingFlier ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Building flier…
                    </span>
                  ) : "Generate Flier"}
                </button>
              </div>
            )}
          </div>

          {/* Right panel — preview */}
          <div className="lg:col-span-3">
            {activeTool === "posts" && (
              <>
                {!generatedPosts && !generatingPosts && (
                  <EmptyPreview
                    icon="📱"
                    title="Posts will appear here"
                    subtitle={selectedProduct ? `Ready to generate for ${selectedProduct.name}` : "Select a product to get started"}
                  />
                )}
                {generatingPosts && <GeneratingState label="Writing captions…" />}
                {generatedPosts && (
                  <SocialPostPreviewCard
                    posts={generatedPosts}
                    product_name={selectedProduct?.name}
                    product_image_url={selectedProduct?.image_url}
                  />
                )}
              </>
            )}
            {activeTool === "flier" && (
              <>
                {!generatedFlier && !generatingFlier && (
                  <EmptyPreview
                    icon="🖼"
                    title="Flier will appear here"
                    subtitle={selectedProduct ? `Ready to generate for ${selectedProduct.name}` : "Select a product to get started"}
                  />
                )}
                {generatingFlier && <GeneratingState label="Building flier…" />}
                {generatedFlier && (
                  <FlierPreviewCard {...(generatedFlier as Parameters<typeof FlierPreviewCard>[0])} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tip: use the agent */}
      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <div className="text-sm font-semibold text-rose-700">Pro tip: Use the Marketer agent</div>
            <p className="text-xs text-rose-600 mt-0.5">
              Chat with the Marketer to generate posts and fliers conversationally — just say "make posts for my [product name]" or "create a flier for [product]".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  icon, title, description, active, onClick, color,
}: {
  icon: string;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  color: "rose" | "purple";
}) {
  const colors = color === "rose"
    ? { active: "border-rose-300 bg-rose-50", badge: "bg-rose-500", ring: "ring-rose-200" }
    : { active: "border-purple-300 bg-purple-50", badge: "bg-purple-600", ring: "ring-purple-200" };

  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
        active ? `${colors.active} ring-2 ${colors.ring}` : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl ${colors.badge} flex items-center justify-center text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</div>
      </div>
    </button>
  );
}

function EmptyPreview({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
    </div>
  );
}

function GeneratingState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-500 rounded-full animate-spin mb-3" />
      <div className="text-sm font-medium text-gray-600">{label}</div>
      <div className="text-xs text-gray-400 mt-1">Using your brand DNA to craft the perfect content…</div>
    </div>
  );
}
