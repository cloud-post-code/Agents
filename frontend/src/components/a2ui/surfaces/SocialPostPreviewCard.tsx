"use client";

import { useState } from "react";

interface PostEntry {
  platform: string;
  platform_label?: string;
  caption: string;
}

export interface SocialPostPreviewCardProps {
  posts: PostEntry[];
  product_name?: string;
  product_image_url?: string;
  brand_name?: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "💙",
  tiktok: "🎵",
  twitter: "🐦",
  pinterest: "📌",
};

const PLATFORM_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  instagram: {
    bg: "from-purple-50 to-pink-50",
    border: "border-purple-100",
    text: "text-purple-700",
    badge: "bg-gradient-to-r from-purple-500 to-pink-500",
  },
  facebook: {
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-100",
    text: "text-blue-700",
    badge: "bg-blue-600",
  },
  tiktok: {
    bg: "from-gray-900 to-gray-800",
    border: "border-gray-700",
    text: "text-white",
    badge: "bg-black",
  },
  twitter: {
    bg: "from-sky-50 to-blue-50",
    border: "border-sky-100",
    text: "text-sky-700",
    badge: "bg-sky-500",
  },
  pinterest: {
    bg: "from-red-50 to-rose-50",
    border: "border-red-100",
    text: "text-red-700",
    badge: "bg-red-600",
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      onClick={copy}
      className="text-xs px-3 py-1.5 rounded-full bg-white/80 border border-white/60 font-medium hover:bg-white transition-colors shadow-sm"
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

function PostCard({ post, productImageUrl }: { post: PostEntry; productImageUrl?: string }) {
  const platform = post.platform.toLowerCase();
  const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.instagram;
  const icon = PLATFORM_ICONS[platform] || "📣";
  const label = post.platform_label || post.platform;
  const isDark = platform === "tiktok";

  return (
    <div className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} overflow-hidden`}>
      {/* Platform header */}
      <div className={`flex items-center justify-between px-4 py-3 ${isDark ? "bg-black/20" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={`text-xs font-semibold ${isDark ? "text-white" : colors.text}`}>{label}</span>
        </div>
        <CopyButton text={post.caption} />
      </div>

      {/* Mock post preview */}
      <div className="px-4 pb-4">
        {/* Fake account header */}
        <div className="flex items-center gap-2 mb-3">
          {productImageUrl ? (
            <img src={productImageUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-rose-300 flex items-center justify-center text-white text-xs font-bold">A</div>
          )}
          <div>
            <div className={`text-xs font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>your_shop</div>
            <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-400"}`}>Just now</div>
          </div>
        </div>

        {/* Product image mock */}
        {productImageUrl && (
          <div className="rounded-xl overflow-hidden mb-3 aspect-square max-h-48 relative">
            <img src={productImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Caption */}
        <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? "text-gray-100" : "text-gray-800"}`}>
          {post.caption}
        </p>
      </div>
    </div>
  );
}

export function SocialPostPreviewCard({
  posts,
  product_name,
  product_image_url,
  brand_name,
}: SocialPostPreviewCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const allCaptions = posts.map((p) => `--- ${p.platform_label || p.platform} ---\n${p.caption}`).join("\n\n");

  if (!posts || posts.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-600">
        No posts generated yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden w-full max-w-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-b border-rose-100 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Social Posts</span>
              {product_name && (
                <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                  {product_name}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{posts.length} platform{posts.length !== 1 ? "s" : ""} generated</div>
          </div>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(allCaptions);
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 font-medium transition-colors"
          >
            Copy All
          </button>
        </div>

        {/* Platform tabs */}
        {posts.length > 1 && (
          <div className="flex gap-1 mt-3">
            {posts.map((p, i) => (
              <button
                key={p.platform}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  activeIdx === i
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-white/70 text-gray-600 hover:bg-white"
                }`}
              >
                <span>{PLATFORM_ICONS[p.platform.toLowerCase()] || "📣"}</span>
                <span>{p.platform_label || p.platform}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active post */}
      <div className="p-4">
        <PostCard post={posts[activeIdx]} productImageUrl={product_image_url} />
      </div>

      {/* Footer hint */}
      <div className="px-5 pb-4">
        <p className="text-xs text-gray-400">
          Paste this caption directly into {posts[activeIdx]?.platform_label || "your platform"}. Image upload is separate.
        </p>
      </div>
    </div>
  );
}
