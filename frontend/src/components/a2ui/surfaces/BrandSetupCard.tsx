"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type SetupTab = "identity" | "voice" | "visual" | "source";

interface BrandDNA {
  brand_name?: string;
  tagline?: string;
  overview?: string;
  product_category?: string;
  target_audience?: string;
  tone_adjectives?: string[];
  writing_style?: string;
  primary_color?: string;
  primary_color_inverse?: string;
  secondary_color?: string;
  secondary_color_inverse?: string;
  logo_url?: string;
  logo_ratio?: string;
  font_family?: string;
  font_weights?: number[];
  background_style?: string;
  imagery_style?: string;
  typography_vibe?: string;
  source?: string;
  source_url?: string;
}

const GOOGLE_FONTS = [
  "Inter", "Lato", "Roboto", "Open Sans", "Montserrat", "Poppins",
  "Playfair Display", "Merriweather", "Raleway", "Nunito", "Lora",
  "Oswald", "PT Serif", "Josefin Sans", "Source Sans Pro", "Libre Baskerville",
  "Cormorant Garamond", "EB Garamond", "DM Sans", "Quicksand",
];

const TONE_OPTIONS = [
  "Elegant", "Artisanal", "Sophisticated", "Timeless", "Warm",
  "Bold", "Playful", "Minimal", "Rustic", "Modern", "Luxurious",
  "Vibrant", "Authentic", "Earthy", "Refined",
];

const QA_QUESTIONS = [
  { key: "business_name", label: "What's your business name?", placeholder: "e.g. Global Threads" },
  { key: "what_you_sell", label: "What do you sell?", placeholder: "e.g. Handmade ceramic mugs and artisanal candles" },
  { key: "who_buys_from_you", label: "Who are your customers?", placeholder: "e.g. Design-conscious homeowners who love handmade goods" },
  { key: "brand_vibe", label: "Describe your brand vibe in a few words", placeholder: "e.g. Warm, minimal, earthy, sophisticated" },
  { key: "tagline_or_slogan", label: "Do you have a tagline or slogan?", placeholder: "e.g. Crafted for a Global Audience" },
  { key: "business_description", label: "Tell us a bit more about your brand story", placeholder: "e.g. We source ethically from artisans around the world..." },
];

export function BrandSetupCard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<SetupTab>("identity");
  const [brand, setBrand] = useState<BrandDNA>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [qaAnswers, setQaAnswers] = useState<Record<string, string>>({});
  const [qaMode, setQaMode] = useState(false);
  const [toneList, setToneList] = useState<string[]>([]);
  const [customTone, setCustomTone] = useState("");
  const [extractMessage, setExtractMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<BrandDNA>("/api/v1/brand", token)
      .then((data) => {
        setBrand(data);
        setToneList(data.tone_adjectives || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function save(patch: Partial<BrandDNA>) {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await apiFetch<BrandDNA>("/api/v1/brand", token, {
        method: "PUT",
        body: JSON.stringify({ ...patch, tone_adjectives: toneList }),
      });
      setBrand(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function extractFromWebsite() {
    if (!websiteUrl || !token) return;
    setExtracting(true);
    setExtractMessage("");
    try {
      const data = await apiFetch<{ brand: BrandDNA }>("/api/v1/brand/extract/url", token, {
        method: "POST",
        body: JSON.stringify({ url: websiteUrl }),
      });
      if (data.brand) {
        setBrand(data.brand);
        setToneList(data.brand.tone_adjectives || []);
        setExtractMessage("Brand extracted! Review the fields below and save.");
        setActiveTab("identity");
      }
    } catch {
      setExtractMessage("Could not extract from that URL. Try another or fill in manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setExtracting(true);
    setExtractMessage("");
    const form = new FormData();
    form.append("file", file);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${API_BASE}/api/v1/brand/extract/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (data.brand) {
        setBrand(data.brand);
        setToneList(data.brand.tone_adjectives || []);
        setExtractMessage("Brand extracted from file! Review the fields and save.");
        setActiveTab("identity");
      }
    } catch {
      setExtractMessage("Could not read that file. Try PDF, DOCX, TXT, or an image.");
    } finally {
      setExtracting(false);
    }
  }

  async function submitQA() {
    if (!token) return;
    setExtracting(true);
    try {
      const data = await apiFetch<{ brand: BrandDNA }>("/api/v1/brand/extract/qa", token, {
        method: "POST",
        body: JSON.stringify(qaAnswers),
      });
      if (data.brand) {
        setBrand(data.brand);
        setToneList(data.brand.tone_adjectives || []);
        setExtractMessage("Brand profile created from your answers! Review and save.");
        setQaMode(false);
        setActiveTab("identity");
      }
    } finally {
      setExtracting(false);
    }
  }

  function toggleTone(t: string) {
    setToneList((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function addCustomTone() {
    const trimmed = customTone.trim();
    if (trimmed && !toneList.includes(trimmed)) {
      setToneList((prev) => [...prev, trimmed]);
    }
    setCustomTone("");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-6 animate-pulse">
        <div className="h-5 w-40 bg-rose-50 rounded mb-4" />
        <div className="h-3 w-full bg-gray-50 rounded mb-2" />
        <div className="h-3 w-3/4 bg-gray-50 rounded" />
      </div>
    );
  }

  const hasBrand = !!(brand.brand_name || brand.primary_color);
  const completionFields = [
    brand.brand_name, brand.tagline, brand.primary_color,
    brand.font_family, brand.tone_adjectives?.length, brand.overview,
  ];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 px-5 py-4 border-b border-rose-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h3 className="font-semibold text-gray-900 text-sm">Brand DNA</h3>
            {hasBrand && (
              <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">
                {brand.brand_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">{completion}% complete</div>
            <div className="w-16 h-1.5 bg-rose-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-400 rounded-full transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick source row */}
        {!qaMode && (
          <div className="flex gap-2 flex-wrap mt-1">
            <button
              onClick={() => setQaMode(true)}
              className="text-xs px-3 py-1 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors font-medium"
            >
              💬 Answer questions
            </button>
            <label className="text-xs px-3 py-1 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors font-medium cursor-pointer">
              📎 Upload file
              <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} />
            </label>
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="🌐 Paste your website URL"
                className="text-xs px-3 py-1 rounded-full border border-rose-200 bg-white text-gray-700 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-rose-300"
                onKeyDown={(e) => e.key === "Enter" && extractFromWebsite()}
              />
              <button
                onClick={extractFromWebsite}
                disabled={!websiteUrl || extracting}
                className="text-xs px-3 py-1 rounded-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
              >
                {extracting ? "Extracting…" : "Extract"}
              </button>
            </div>
          </div>
        )}

        {extractMessage && (
          <p className="text-xs text-rose-600 mt-2 font-medium">{extractMessage}</p>
        )}
      </div>

      {/* Q&A Mode */}
      {qaMode ? (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-800">Tell us about your brand</p>
            <button onClick={() => setQaMode(false)} className="text-xs text-gray-400 hover:text-gray-600">
              ✕ Cancel
            </button>
          </div>
          {QA_QUESTIONS.map((q) => (
            <div key={q.key}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{q.label}</label>
              <textarea
                value={qaAnswers[q.key] || ""}
                onChange={(e) => setQaAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300 resize-none"
              />
            </div>
          ))}
          <button
            onClick={submitQA}
            disabled={extracting}
            className="w-full py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 transition-colors"
          >
            {extracting ? "Creating brand profile…" : "Create my brand profile"}
          </button>
        </div>
      ) : (
        <>
          {/* Tab nav */}
          <div className="flex border-b border-gray-100">
            {(["identity", "voice", "visual", "source"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs font-medium py-2.5 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? "border-rose-400 text-rose-600 bg-rose-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "identity" ? "🏷 Identity" : tab === "voice" ? "🗣 Voice" : tab === "visual" ? "🎨 Visual" : "🔗 Source"}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Identity Tab */}
            {activeTab === "identity" && (
              <div className="space-y-4">
                <Field label="Brand Name" value={brand.brand_name} onSave={(v) => save({ brand_name: v })} placeholder="Global Threads" />
                <Field label="Tagline" value={brand.tagline} onSave={(v) => save({ tagline: v })} placeholder="Crafted for a Global Audience." />
                <Field label="Product Category" value={brand.product_category} onSave={(v) => save({ product_category: v })} placeholder="Artisanal Home Decor and Fashion Accessories" />
                <Field label="Target Audience" value={brand.target_audience} onSave={(v) => save({ target_audience: v })} placeholder="Culturally conscious, design-oriented individuals…" textarea />
                <Field label="Brand Overview" value={brand.overview} onSave={(v) => save({ overview: v })} placeholder="A lifestyle brand focused on ethical sourcing…" textarea />
              </div>
            )}

            {/* Voice Tab */}
            {activeTab === "voice" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Tone Adjectives</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTone(t)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          toneList.includes(t)
                            ? "bg-rose-500 border-rose-500 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {toneList.filter((t) => !TONE_OPTIONS.includes(t)).map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-rose-500 text-white border border-rose-500 font-medium mr-1.5 mb-1.5 inline-flex items-center gap-1">
                      {t}
                      <button onClick={() => setToneList((prev) => prev.filter((x) => x !== t))} className="ml-0.5 opacity-70 hover:opacity-100">✕</button>
                    </span>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      value={customTone}
                      onChange={(e) => setCustomTone(e.target.value)}
                      placeholder="Add custom tone word…"
                      onKeyDown={(e) => e.key === "Enter" && addCustomTone()}
                      className="text-xs flex-1 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-300"
                    />
                    <button onClick={addCustomTone} className="text-xs px-3 py-1.5 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 font-medium">Add</button>
                  </div>
                </div>
                <Field label="Writing Style" value={brand.writing_style} onSave={(v) => save({ writing_style: v })} placeholder="Descriptive, evocative, polished medium-length prose…" textarea />
                <button
                  onClick={() => save({})}
                  disabled={saving}
                  className="w-full py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Voice"}
                </button>
              </div>
            )}

            {/* Visual Tab */}
            {activeTab === "visual" && (
              <div className="space-y-4">
                {/* Colors */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Brand Colors</label>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label="Primary"
                      value={brand.primary_color}
                      onChange={(v) => setBrand((b) => ({ ...b, primary_color: v }))}
                    />
                    <ColorField
                      label="Primary Inverse"
                      value={brand.primary_color_inverse}
                      onChange={(v) => setBrand((b) => ({ ...b, primary_color_inverse: v }))}
                    />
                    <ColorField
                      label="Secondary"
                      value={brand.secondary_color}
                      onChange={(v) => setBrand((b) => ({ ...b, secondary_color: v }))}
                    />
                    <ColorField
                      label="Secondary Inverse"
                      value={brand.secondary_color_inverse}
                      onChange={(v) => setBrand((b) => ({ ...b, secondary_color_inverse: v }))}
                    />
                  </div>
                </div>

                {/* Font */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Font Family (Google Fonts)</label>
                  <select
                    value={brand.font_family || ""}
                    onChange={(e) => setBrand((b) => ({ ...b, font_family: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300 bg-white"
                  >
                    <option value="">Select a Google Font…</option>
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Font weights */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Font Weights</label>
                  <div className="flex flex-wrap gap-2">
                    {[300, 400, 500, 600, 700, 800].map((w) => (
                      <button
                        key={w}
                        onClick={() => {
                          const current = brand.font_weights || [400, 700];
                          setBrand((b) => ({
                            ...b,
                            font_weights: current.includes(w) ? current.filter((x) => x !== w) : [...current, w],
                          }));
                        }}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                          (brand.font_weights || [400, 700]).includes(w)
                            ? "bg-rose-500 border-rose-500 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                        }`}
                        style={{ fontWeight: w }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Logo Ratio" value={brand.logo_ratio} onSave={(v) => save({ logo_ratio: v })} placeholder="1:1" />
                <Field label="Background Style" value={brand.background_style} onSave={(v) => save({ background_style: v })} placeholder="Clean minimalist white space…" textarea />
                <Field label="Imagery Style" value={brand.imagery_style} onSave={(v) => save({ imagery_style: v })} placeholder="Warm, high-end lifestyle photography…" textarea />
                <Field label="Typography Vibe" value={brand.typography_vibe} onSave={(v) => save({ typography_vibe: v })} placeholder="Sophisticated editorial style…" textarea />

                <button
                  onClick={() => save({
                    primary_color: brand.primary_color,
                    primary_color_inverse: brand.primary_color_inverse,
                    secondary_color: brand.secondary_color,
                    secondary_color_inverse: brand.secondary_color_inverse,
                    font_family: brand.font_family,
                    font_weights: brand.font_weights,
                  })}
                  disabled={saving}
                  className="w-full py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Visual Identity"}
                </button>
              </div>
            )}

            {/* Source Tab */}
            {activeTab === "source" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-gray-50 p-4 text-sm">
                  <div className="font-medium text-gray-700 mb-1">Current source</div>
                  <div className="text-gray-500 capitalize">{brand.source || "Not set"}</div>
                  {brand.source_url && (
                    <div className="text-xs text-rose-500 mt-1 truncate">{brand.source_url}</div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  You can re-extract brand info at any time by uploading a new file, pasting a URL, or answering questions again using the buttons at the top.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, value, onSave, placeholder, textarea,
}: {
  label: string;
  value?: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => setDraft(value || ""), [value]);

  const Tag = textarea ? "textarea" : "input";
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      {editing ? (
        <div className="flex gap-2">
          <Tag
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={textarea ? 3 : undefined}
            className="flex-1 text-sm border border-rose-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-400 resize-none"
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { onSave(draft); setEditing(false); }}
              className="text-xs px-2.5 py-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 font-medium"
            >Save</button>
            <button
              onClick={() => { setDraft(value || ""); setEditing(false); }}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
            >✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-700 hover:border-rose-200 hover:bg-rose-50/30 transition-colors min-h-[2.25rem]"
        >
          {value ? (
            <span>{value}</span>
          ) : (
            <span className="text-gray-400 italic">{placeholder || `Set ${label.toLowerCase()}…`}</span>
          )}
        </button>
      )}
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <div
        className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0 cursor-pointer"
        style={{ backgroundColor: value || "#e5e7eb" }}
      >
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="opacity-0 w-6 h-6 cursor-pointer"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#rrggbb"
          className="text-xs font-mono text-gray-700 bg-transparent w-full focus:outline-none"
          maxLength={7}
        />
      </div>
    </div>
  );
}
