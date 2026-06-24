"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type SetupTab = "identity_voice" | "visual" | "logo" | "setup";

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
  {
    key: "brand_sound_feel",
    label: "How do you want your brand to sound when talking to people? What does it make them feel?",
    placeholder: "e.g. Warm and confident, like a knowledgeable friend. It should make people feel inspired and understood.",
    rows: 4,
  },
  {
    key: "who_connect_with",
    label: "Who are you trying to connect with, and what do they need to hear from you?",
    placeholder: "e.g. Conscious shoppers who want quality over quantity. They need to hear that this was made with real care.",
    rows: 4,
  },
  {
    key: "words_and_rules",
    label: "What words, phrases, tones, or topics should your brand always use — or never use?",
    placeholder: "e.g. Always: handcrafted, artisan, story. Never: cheap, discount, fast fashion.",
    rows: 4,
  },
];

// ─── Voice button ─────────────────────────────────────────────────────────────

function useSpeechRecognition(onResult: (text: string) => void) {
  const recognitionRef = useRef<{ start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null } | null>(null);
  const [listening, setListening] = useState(false);

  function startListening() {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => typeof recognitionRef.current; webkitSpeechRecognition?: new () => typeof recognitionRef.current }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => typeof recognitionRef.current }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognitionRef.current = new SpeechRecognition();
    const rec = recognitionRef.current;
    if (!rec) return;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return { listening, startListening, stopListening };
}

function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const { listening, startListening, stopListening } = useSpeechRecognition(onTranscript);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      title={listening ? "Stop recording" : "Speak your answer"}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
        listening
          ? "bg-red-500 border-red-500 text-white animate-pulse"
          : "bg-white border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-500"
      }`}
    >
      {listening ? "🔴 Recording…" : "🎙 Speak"}
    </button>
  );
}

// ─── Setup tab: source picker + Q&A ──────────────────────────────────────────

function SetupTab({
  onSubmitQA,
  onFile,
  onUrl,
  extracting,
}: {
  onSubmitQA: (answers: Record<string, string>) => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrl: (url: string) => void;
  extracting: boolean;
}) {
  const [mode, setMode] = useState<"picker" | "qa">("picker");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [url, setUrl] = useState("");

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const filled = QA_QUESTIONS.filter((q) => (answers[q.key] || "").trim().length > 0).length;

  if (mode === "qa") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Tell us about your brand</p>
            <p className="text-xs text-gray-500 mt-0.5">Answer what you can — nothing is required. Type or speak.</p>
          </div>
          <button onClick={() => setMode("picker")} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">← Back</button>
        </div>

        {QA_QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <label className="text-sm font-medium text-gray-800 leading-snug">{q.label}</label>
              <VoiceButton onTranscript={(t) => setAnswer(q.key, (answers[q.key] ? answers[q.key] + " " : "") + t)} />
            </div>
            <textarea
              value={answers[q.key] || ""}
              onChange={(e) => setAnswer(q.key, e.target.value)}
              placeholder={q.placeholder}
              rows={q.rows}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-rose-300 resize-none leading-relaxed"
            />
          </div>
        ))}

        <button
          onClick={() => onSubmitQA(answers)}
          disabled={extracting || filled === 0}
          className="w-full py-3 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-40 transition-colors"
        >
          {extracting ? "Building your brand profile…" : `Build my brand profile${filled > 0 ? ` (${filled}/${QA_QUESTIONS.length} answered)` : ""}`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-sm font-semibold text-gray-800">How would you like to set up your brand?</p>
        <p className="text-xs text-gray-500 mt-0.5">You can always edit or re-import later</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Q&A */}
        <button
          onClick={() => setMode("qa")}
          className="flex items-center gap-4 p-4 rounded-2xl border-2 border-rose-100 bg-rose-50/50 hover:border-rose-300 hover:bg-rose-50 transition-all text-left group"
        >
          <div className="w-11 h-11 rounded-xl bg-rose-500 flex items-center justify-center text-xl shrink-0 shadow-sm">💬</div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Answer 3 questions</div>
            <div className="text-xs text-gray-500 mt-0.5">Tell us how your brand sounds and who it&apos;s for — type or speak your answers</div>
          </div>
          <span className="ml-auto text-rose-300 group-hover:text-rose-500 text-lg">→</span>
        </button>

        {/* File upload */}
        <label className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50/50 hover:border-rose-200 hover:bg-rose-50/30 transition-all text-left cursor-pointer group">
          <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center text-xl shrink-0 shadow-sm">📎</div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Upload a file</div>
            <div className="text-xs text-gray-500 mt-0.5">Brand guide, PDF, DOCX, image — we&apos;ll extract your brand info automatically</div>
          </div>
          {extracting ? (
            <span className="ml-auto text-xs text-rose-500 animate-pulse">Extracting…</span>
          ) : (
            <span className="ml-auto text-gray-300 group-hover:text-rose-400 text-lg">→</span>
          )}
          <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={onFile} disabled={extracting} />
        </label>

        {/* Website URL */}
        <div className="flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50/50">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-xl shrink-0 shadow-sm">🌐</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 mb-1">Paste your website URL</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourbrand.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-300 bg-white"
              onKeyDown={(e) => e.key === "Enter" && url && onUrl(url)}
            />
          </div>
          <button
            onClick={() => url && onUrl(url)}
            disabled={!url || extracting}
            className="shrink-0 text-xs px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 font-medium transition-colors"
          >
            {extracting ? "…" : "Go"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BrandSetupCard({ initialTab }: { initialTab?: SetupTab }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<SetupTab>(initialTab || "identity_voice");
  const [brand, setBrand] = useState<BrandDNA>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [toneList, setToneList] = useState<string[]>([]);
  const [customTone, setCustomTone] = useState("");
  const [notice, setNotice] = useState("");
  const [generatingLogo, setGeneratingLogo] = useState(false);

  const [identityVoiceDraft, setIdentityVoiceDraft] = useState<Partial<BrandDNA>>({});
  const [visualDraft, setVisualDraft] = useState<Partial<BrandDNA>>({});

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

  useEffect(() => {
    setIdentityVoiceDraft({
      brand_name: brand.brand_name,
      tagline: brand.tagline,
      product_category: brand.product_category,
      target_audience: brand.target_audience,
      overview: brand.overview,
      writing_style: brand.writing_style,
    });
    setVisualDraft({
      primary_color: brand.primary_color,
      primary_color_inverse: brand.primary_color_inverse,
      secondary_color: brand.secondary_color,
      secondary_color_inverse: brand.secondary_color_inverse,
      font_family: brand.font_family,
      font_weights: brand.font_weights,
      background_style: brand.background_style,
      imagery_style: brand.imagery_style,
      typography_vibe: brand.typography_vibe,
    });
  }, [brand.brand_name]);

  async function saveTab(patch: Partial<BrandDNA>) {
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
      setNotice("Saved!");
      setTimeout(() => { setSaved(false); setNotice(""); }, 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setExtracting(true);
    setNotice("");
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
        setNotice("Brand extracted from file!");
        setActiveTab("identity_voice");
      }
    } catch {
      setNotice("Could not read that file. Try PDF, DOCX, TXT, or an image.");
    } finally {
      setExtracting(false);
    }
  }

  async function extractFromWebsite(url: string) {
    if (!token) return;
    setExtracting(true);
    setNotice("");
    try {
      const data = await apiFetch<{ brand: BrandDNA }>("/api/v1/brand/extract/url", token, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      if (data.brand) {
        setBrand(data.brand);
        setToneList(data.brand.tone_adjectives || []);
        setNotice("Brand extracted from your website!");
        setActiveTab("identity_voice");
      }
    } catch {
      setNotice("Could not extract from that URL. Try another or fill in manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function submitQA(answers: Record<string, string>) {
    if (!token) return;
    setExtracting(true);
    try {
      const data = await apiFetch<{ brand: BrandDNA }>("/api/v1/brand/extract/qa", token, {
        method: "POST",
        body: JSON.stringify(answers),
      });
      if (data.brand) {
        setBrand(data.brand);
        setToneList(data.brand.tone_adjectives || []);
        setNotice("Brand profile created from your answers!");
        setActiveTab("identity_voice");
      }
    } finally {
      setExtracting(false);
    }
  }

  async function generateLogo() {
    if (!token) return;
    setGeneratingLogo(true);
    setNotice("Generating logo…");
    try {
      const data = await apiFetch<{ logo_url: string }>("/api/v1/brand/generate-logo", token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data.logo_url) {
        await saveTab({ logo_url: data.logo_url });
        setNotice("Logo generated!");
      }
    } catch {
      setNotice("Logo generation requires a brand name and colors. Fill those in first.");
    } finally {
      setGeneratingLogo(false);
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      const url = data.url || data.file_url;
      if (url) {
        await saveTab({ logo_url: url });
        setBrand((b) => ({ ...b, logo_url: url }));
        setNotice("Logo uploaded!");
      }
    } catch {
      setNotice("Upload failed. Try again.");
    }
  }

  function toggleTone(t: string) {
    setToneList((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function addCustomTone() {
    const trimmed = customTone.trim();
    if (trimmed && !toneList.includes(trimmed)) setToneList((prev) => [...prev, trimmed]);
    setCustomTone("");
  }

  // Completion — ≥20% = "Ready"
  const filledFields = [
    brand.brand_name, brand.tagline, brand.primary_color,
    brand.font_family, toneList.length > 0 ? "yes" : null,
    brand.overview, brand.writing_style, brand.logo_url,
  ].filter(Boolean).length;
  const pct = Math.round((filledFields / 8) * 100);
  const isReady = pct >= 20;

  if (loading) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-6 animate-pulse">
        <div className="h-5 w-40 bg-rose-50 rounded mb-4" />
        <div className="h-3 w-full bg-gray-50 rounded mb-2" />
        <div className="h-3 w-3/4 bg-gray-50 rounded" />
      </div>
    );
  }

  const TAB_CONFIG: { key: SetupTab; label: string }[] = [
    { key: "identity_voice", label: "🏷 Identity & Voice" },
    { key: "visual", label: "🎨 Visual" },
    { key: "logo", label: "🖼 Logo" },
    { key: "setup", label: "⚙ Setup" },
  ];

  return (
    <div className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 px-5 py-3.5 border-b border-rose-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            <span className="font-semibold text-gray-900 text-sm">Brand DNA</span>
            {brand.brand_name && (
              <span className="text-xs bg-white border border-rose-200 text-rose-700 px-2 py-0.5 rounded-full font-medium">
                {brand.brand_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isReady ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Ready</span>
            ) : (
              <span className="text-xs text-gray-400">{pct}%</span>
            )}
            <div className="w-14 h-1.5 bg-rose-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        {notice && (
          <p className={`text-xs mt-1.5 font-medium ${notice.includes("not") || notice.includes("fail") ? "text-amber-600" : "text-rose-600"}`}>
            {notice}
          </p>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-100">
        {TAB_CONFIG.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 text-xs font-medium py-2.5 border-b-2 transition-colors ${
              activeTab === key
                ? "border-rose-400 text-rose-600 bg-rose-50/40"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* ── Identity & Voice tab ── */}
        {activeTab === "identity_voice" && (
          <div className="space-y-4">
            <TextField label="Brand Name" value={identityVoiceDraft.brand_name} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, brand_name: v }))} placeholder="e.g. Global Threads" />
            <TextField label="Tagline" value={identityVoiceDraft.tagline} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, tagline: v }))} placeholder="e.g. Crafted for a Global Audience" />
            <TextField label="Product Category" value={identityVoiceDraft.product_category} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, product_category: v }))} placeholder="e.g. Artisanal Home Decor" />
            <TextField label="Target Audience" value={identityVoiceDraft.target_audience} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, target_audience: v }))} placeholder="e.g. Design-conscious shoppers who value handmade goods" textarea />
            <TextField label="Brand Overview" value={identityVoiceDraft.overview} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, overview: v }))} placeholder="e.g. A lifestyle brand focused on ethical sourcing and global craftsmanship" textarea />

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Tone</label>
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

            <TextField label="Writing Style" value={identityVoiceDraft.writing_style} onChange={(v) => setIdentityVoiceDraft((d) => ({ ...d, writing_style: v }))} placeholder="e.g. Descriptive, evocative, polished prose. Tactile and story-driven." textarea />

            <SaveButton saving={saving} saved={saved} onClick={() => saveTab(identityVoiceDraft)} />
          </div>
        )}

        {/* ── Visual tab ── */}
        {activeTab === "visual" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Brand Colors</label>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Primary" value={visualDraft.primary_color} onChange={(v) => setVisualDraft((d) => ({ ...d, primary_color: v }))} />
                <ColorField label="Primary Inverse" value={visualDraft.primary_color_inverse} onChange={(v) => setVisualDraft((d) => ({ ...d, primary_color_inverse: v }))} />
                <ColorField label="Secondary" value={visualDraft.secondary_color} onChange={(v) => setVisualDraft((d) => ({ ...d, secondary_color: v }))} />
                <ColorField label="Secondary Inverse" value={visualDraft.secondary_color_inverse} onChange={(v) => setVisualDraft((d) => ({ ...d, secondary_color_inverse: v }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Font Family (Google Fonts)</label>
              <select
                value={visualDraft.font_family || ""}
                onChange={(e) => setVisualDraft((d) => ({ ...d, font_family: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300 bg-white"
              >
                <option value="">Select a font…</option>
                {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Font Weights</label>
              <div className="flex flex-wrap gap-2">
                {[300, 400, 500, 600, 700, 800].map((w) => {
                  const active = (visualDraft.font_weights || brand.font_weights || [400, 700]).includes(w);
                  return (
                    <button
                      key={w}
                      onClick={() => {
                        const current = visualDraft.font_weights || brand.font_weights || [400, 700];
                        setVisualDraft((d) => ({
                          ...d,
                          font_weights: active ? current.filter((x) => x !== w) : [...current, w],
                        }));
                      }}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                        active ? "bg-rose-500 border-rose-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                      }`}
                      style={{ fontWeight: w }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </div>

            <TextField label="Background Style" value={visualDraft.background_style} onChange={(v) => setVisualDraft((d) => ({ ...d, background_style: v }))} placeholder="e.g. Clean minimalist white space with soft off-white sections" textarea />
            <TextField label="Imagery Style" value={visualDraft.imagery_style} onChange={(v) => setVisualDraft((d) => ({ ...d, imagery_style: v }))} placeholder="e.g. Warm lifestyle photography with natural textures" textarea />
            <TextField label="Typography Vibe" value={visualDraft.typography_vibe} onChange={(v) => setVisualDraft((d) => ({ ...d, typography_vibe: v }))} placeholder="e.g. High-contrast serifs for titles, modern sans-serifs for body" textarea />

            <SaveButton saving={saving} saved={saved} onClick={() => saveTab(visualDraft)} />
          </div>
        )}

        {/* ── Logo tab ── */}
        {activeTab === "logo" && (
          <div className="space-y-5">
            {brand.logo_url && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg bg-white border border-gray-200 p-1" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Current logo</p>
                  <p className="text-xs text-gray-400 mt-0.5">Upload a new one to replace it</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Upload Logo</label>
              <label className="flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed border-rose-200 hover:border-rose-400 cursor-pointer transition-colors group bg-rose-50/30 hover:bg-rose-50">
                <span className="text-2xl">📎</span>
                <div className="text-center">
                  <span className="text-sm font-medium text-rose-600 group-hover:text-rose-700">Choose a file</span>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG, WebP — recommended 500×500 px</p>
                </div>
                <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={uploadLogo} />
              </label>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-sm font-semibold text-purple-900 mb-1">Generate a logo with AI</p>
              <p className="text-xs text-purple-600 mb-3">
                We&apos;ll use your brand name, colors, and style to generate a logo concept. Fill in Identity &amp; Voice first.
              </p>
              <div className="flex items-center gap-2 text-xs text-purple-500 mb-3">
                <span className={`w-2 h-2 rounded-full ${brand.brand_name ? "bg-green-400" : "bg-gray-300"}`} />
                Brand name {brand.brand_name ? `"${brand.brand_name}"` : "(not set)"}
                <span className={`w-2 h-2 rounded-full ml-2 ${brand.primary_color ? "bg-green-400" : "bg-gray-300"}`} />
                Primary color {brand.primary_color || "(not set)"}
              </div>
              <button
                onClick={generateLogo}
                disabled={generatingLogo || !brand.brand_name}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                {generatingLogo ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Generating…
                  </span>
                ) : "✨ Generate Logo"}
              </button>
              {!brand.brand_name && (
                <p className="text-xs text-purple-400 mt-2 text-center">Set your brand name in Identity &amp; Voice first</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Logo Ratio</label>
              <div className="flex gap-2">
                {["1:1", "16:9", "4:1"].map((r) => (
                  <button
                    key={r}
                    onClick={() => saveTab({ logo_ratio: r })}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      brand.logo_ratio === r
                        ? "border-rose-400 bg-rose-50 text-rose-600"
                        : "border-gray-200 text-gray-600 hover:border-rose-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Setup tab ── */}
        {activeTab === "setup" && (
          <SetupTab
            onSubmitQA={submitQA}
            onFile={handleFileUpload}
            onUrl={extractFromWebsite}
            extracting={extracting}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        saved
          ? "bg-green-500 text-white"
          : "bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
      }`}
    >
      {saving ? "Saving…" : saved ? "✓ Saved!" : "Save"}
    </button>
  );
}

function TextField({
  label, value, onChange, placeholder, textarea,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const Tag = textarea ? "textarea" : "input";
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <Tag
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-300 resize-none bg-gray-50 focus:bg-white transition-colors"
      />
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
      <div className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0 cursor-pointer overflow-hidden relative">
        <div className="absolute inset-0" style={{ backgroundColor: value || "#e5e7eb" }} />
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
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
