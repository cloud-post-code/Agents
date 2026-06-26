"use client";

import { useState, useEffect, useRef } from "react";
import { AgentConfig } from "@/lib/agents";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, getApiBase } from "@/lib/api";
import { SaveProfileCard } from "@/components/a2ui/surfaces/SaveProfileCard";
import { EditProductCard } from "@/components/a2ui/surfaces/EditProductCard";
import { SearchProductCard } from "@/components/a2ui/surfaces/SearchProductCard";
import { VariantCard } from "@/components/a2ui/surfaces/VariantCard";
import { RemoveProductCard } from "@/components/a2ui/surfaces/RemoveProductCard";
import { ProductImagesCard } from "@/components/a2ui/surfaces/ProductImagesCard";
import { ConfirmProductCard } from "@/components/a2ui/surfaces/ConfirmProductCard";
import { MultiProductCard } from "@/components/a2ui/surfaces/MultiProductCard";
import { VariantConfirmCard } from "@/components/a2ui/surfaces/VariantConfirmCard";
import { ProductListCard } from "@/components/a2ui/surfaces/ProductListCard";
import { DiscountCard } from "@/components/a2ui/surfaces/DiscountCard";
import { BulkListingCard } from "@/components/a2ui/surfaces/BulkListingCard";
import { BrandSetupCard } from "@/components/a2ui/surfaces/BrandSetupCard";
import { SocialPostPreviewCard } from "@/components/a2ui/surfaces/SocialPostPreviewCard";
import { FlierPreviewCard } from "@/components/a2ui/surfaces/FlierPreviewCard";
import { ProductPickerCard, ProductPickerItem } from "@/components/a2ui/surfaces/ProductPickerCard";
import { MarketingStudioCard } from "@/components/a2ui/surfaces/MarketingStudioCard";
import { MultiFlierPreviewCard } from "@/components/a2ui/surfaces/MultiFlierPreviewCard";

type MessageKind = "user" | "assistant" | "task_created" | "a2ui" | "card";

interface Message {
  role: MessageKind;
  content: string;
  id: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

interface HistoryMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface AgentShellProps {
  agent: AgentConfig;
}

function TaskCreatedCard({ payload }: { payload: Record<string, unknown> }) {
  const title = String(payload.title ?? "");
  const taskId = payload.task_id ? String(payload.task_id) : null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-600 font-semibold">✓ Task Created</span>
        <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          pending approval
        </span>
      </div>
      <p className="text-gray-700 font-medium">{title}</p>
      {taskId && (
        <p className="text-xs text-gray-400 mt-1 font-mono">id: {taskId}</p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        Review and approve this in your{" "}
        <a href="/tasks" className="text-amber-600 underline">Tasks queue</a>.
      </p>
    </div>
  );
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Reject placeholder values like [image] or empty strings
  if (!value || value.startsWith("[") || value.startsWith("data:")) return false;
  // Must be an actual http(s) URL
  if (!/^https?:\/\/.+/i.test(value)) return false;
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(value) ||
    value.includes("/uploads/") || value.includes("/images/") ||
    (value.includes("r2.dev") || value.includes("railway")) && value.includes("http");
}

function A2UICard({ payload, onProductPicked, onMultiProductPicked, onAction }: { payload: Record<string, unknown>; onProductPicked?: (product: ProductPickerItem) => void; onMultiProductPicked?: (products: ProductPickerItem[]) => void; onAction?: (msg: string) => void }) {
  const surface = String(payload.surface ?? payload.component ?? "surface");
  // Support both nested props ({surface, props:{...}}) and flat ({surface, image_url, name, ...})
  const rawProps = (payload.props && typeof payload.props === "object")
    ? payload.props as Record<string, unknown>
    : payload;
  // Remove surface/component/components keys from flat spread
  const { surface: _s, component: _c, components: _co, ...props } = rawProps as Record<string, unknown>;
  void _s; void _c; void _co;

  if (surface === "save_profile") return <SaveProfileCard {...(props as unknown as Parameters<typeof SaveProfileCard>[0])} />;
  if (surface === "edit_product") return <EditProductCard {...(props as unknown as Parameters<typeof EditProductCard>[0])} />;
  if (surface === "search_products") return <SearchProductCard {...(props as unknown as Parameters<typeof SearchProductCard>[0])} />;
  if (surface === "product_variants") return <VariantCard {...(props as unknown as Parameters<typeof VariantCard>[0])} />;
  if (surface === "remove_product") return <RemoveProductCard {...(props as unknown as Parameters<typeof RemoveProductCard>[0])} />;
  if (surface === "product_images") return <ProductImagesCard {...(props as unknown as Parameters<typeof ProductImagesCard>[0])} />;
  if (surface === "confirm_product") return <ConfirmProductCard {...(props as unknown as Parameters<typeof ConfirmProductCard>[0])} />;
  if (surface === "multi_product") return <MultiProductCard {...(props as unknown as Parameters<typeof MultiProductCard>[0])} />;
  if (surface === "variant_product") return <VariantConfirmCard {...(props as unknown as Parameters<typeof VariantConfirmCard>[0])} />;
  if (surface === "product_list") return <ProductListCard {...(props as unknown as Parameters<typeof ProductListCard>[0])} onAction={onAction} />;
  if (surface === "multi_flier_preview") return <MultiFlierPreviewCard {...(props as unknown as Parameters<typeof MultiFlierPreviewCard>[0])} />;
  if (surface === "discount") return <DiscountCard {...(props as unknown as Parameters<typeof DiscountCard>[0])} />;
  if (surface === "bulk_listing") return <BulkListingCard {...(props as unknown as Parameters<typeof BulkListingCard>[0])} />;
  if (surface === "brand_setup") return <BrandSetupCard initialTab={(props as { tab?: "identity_voice" | "visual" | "logo" | "setup" }).tab} />;
  if (surface === "social_post_preview") return <SocialPostPreviewCard {...(props as unknown as Parameters<typeof SocialPostPreviewCard>[0])} />;
  if (surface === "flier_preview") return <FlierPreviewCard {...(props as unknown as Parameters<typeof FlierPreviewCard>[0])} />;
  if (surface === "product_picker") return (
    <ProductPickerCard
      {...(props as unknown as Parameters<typeof ProductPickerCard>[0])}
      onSelect={onProductPicked}
      onMultiSelect={onMultiProductPicked}
    />
  );
  if (surface === "marketing_studio") return (
    <MarketingStudioCard {...(props as unknown as Parameters<typeof MarketingStudioCard>[0])} />
  );

  // Generic fallback — render images as <img>, everything else as readable text
  const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== null);
  const surfaceLabel = surface.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-700 font-semibold">{surfaceLabel}</span>
      </div>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-gray-500 italic">No details provided.</p>
        )}
        {entries.map(([key, value]) => {
          if (isImageUrl(value)) {
            return (
              <div key={key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt={key.replace(/_/g, " ")}
                  className="w-full max-h-48 object-cover rounded-xl"
                />
              </div>
            );
          }
          return (
            <div key={key} className="flex gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0 capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-medium text-gray-800 break-words">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentWelcome({
  agent, agentColor, onExample,
}: {
  agent: AgentConfig;
  agentColor: string;
  onExample: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
      {/* Avatar */}
      <div className={`w-16 h-16 rounded-2xl ${agentColor} flex items-center justify-center text-3xl mb-4 shadow-md`}>
        {agent.icon}
      </div>

      {/* Name + tagline */}
      <h2 className="text-lg font-bold text-gray-900">{agent.name}</h2>
      <p className="text-sm text-gray-500 mb-1">{agent.tagline}</p>

      {/* Detail */}
      <p className="text-sm text-gray-600 max-w-sm leading-relaxed mb-6">
        {agent.detail}
      </p>

      {/* Capabilities */}
      <div className="w-full max-w-sm mb-6 text-left">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 text-center">What I can do</p>
        <ul className="space-y-1.5">
          {agent.capabilities.map((cap) => (
            <li key={cap} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
              <span>{cap}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Example prompts */}
      <div className="w-full max-w-sm text-left">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 text-center">Try asking</p>
        <div className="grid grid-cols-1 gap-2">
          {agent.examples.map((ex) => (
            <button
              key={ex}
              onClick={() => onExample(ex)}
              className="text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              &ldquo;{ex}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  const label = new Date(date).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

interface AttachedFile {
  fileId: string;
  url: string;
  type: "image" | "csv";
  filename: string;
}

export function AgentShell({ agent }: AgentShellProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestId, setOldestId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>("");
  const tokenRef = useRef<string | null>(null);
  const roleRef = useRef<string>(agent.role);
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we should auto-scroll (true for new messages, false after loading older ones)
  const shouldScrollRef = useRef(true);

  tokenRef.current = token;
  roleRef.current = agent.role;

  function parseHistoryMessages(raw: HistoryMessage[]): Message[] {
    return raw
      .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "card")
      .reduce<Message[]>((acc, m) => {
        if (m.role === "card") {
          try {
            const card = JSON.parse(m.content) as { type: string; payload: Record<string, unknown> };
            acc.push({ id: m.id, role: card.type as MessageKind, content: "", payload: card.payload, created_at: m.created_at });
          } catch {
            // skip malformed card rows
          }
        } else {
          acc.push({ id: m.id, role: m.role as MessageKind, content: m.content, created_at: m.created_at });
        }
        return acc;
      }, []);
  }

  // Initial load — 30 most recent messages
  useEffect(() => {
    if (!token) return;
    apiFetch<{ session_id: string; role: string; messages: HistoryMessage[]; has_more: boolean }>(
      `/api/v1/agents/${agent.role}/history?limit=30`,
      token
    )
      .then((data) => {
        const loaded = parseHistoryMessages(data.messages);
        setMessages(loaded);
        setHasMore(data.has_more ?? false);
        setOldestId(loaded[0]?.id ?? null);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, agent.role]);

  // Load older messages when user clicks "Load earlier"
  const loadMoreMessages = async () => {
    if (!token || !oldestId || loadingMore) return;
    setLoadingMore(true);

    // Remember scroll height before prepending so we can restore position
    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;

    try {
      const data = await apiFetch<{ session_id: string; role: string; messages: HistoryMessage[]; has_more: boolean }>(
        `/api/v1/agents/${agent.role}/history?limit=30&before=${oldestId}`,
        token
      );
      const older = parseHistoryMessages(data.messages);
      if (older.length === 0) { setHasMore(false); return; }

      shouldScrollRef.current = false;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(data.has_more ?? false);
      setOldestId(older[0]?.id ?? oldestId);

      // After React renders the prepended messages, restore scroll position
      requestAnimationFrame(() => {
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight - prevScrollHeight;
        }
        shouldScrollRef.current = true;
      });
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false);
    }
  };

  // Connect WebSocket after history is loaded — auto-reconnects on close
  useEffect(() => {
    if (!token || !historyLoaded) return;

    let destroyed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;

    const connect = () => {
      if (destroyed) return;
      const base = getApiBase().replace(/^https/, "wss").replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/ws/agent/${roleRef.current}/chat`);

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        retryDelay = 1000;
        ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // If the socket closed mid-stream, unlock the input
        stopStreaming();
        pendingRef.current = "";
        // Finalise any partial streaming message
        setMessages((prev) =>
          prev.map((m) => (m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m))
        );
        if (!destroyed) {
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 15000);
            connect();
          }, retryDelay);
        }
      };

      ws.onerror = () => {
        // Always unlock input on error — onclose fires after this
        stopStreaming();
        pendingRef.current = "";
      };

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.type === "session_id") {
          return;
        }

        if (data.type === "token") {
          pendingRef.current += data.content;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === "streaming") {
              return [...prev.slice(0, -1), { ...last, content: pendingRef.current }];
            }
            return [...prev, { role: "assistant", content: pendingRef.current, id: "streaming" }];
          });

        } else if (data.type === "task_created") {
          setMessages((prev) => {
            const finalised = prev.map((m) =>
              m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m
            );
            return [...finalised, {
              role: "task_created" as MessageKind,
              content: "",
              id: crypto.randomUUID(),
              payload: data.payload ?? {},
            }];
          });
          pendingRef.current = "";

        } else if (data.type === "a2ui") {
          setMessages((prev) => {
            const finalised = prev.map((m) =>
              m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m
            );
            return [...finalised, {
              role: "a2ui" as MessageKind,
              content: "",
              id: crypto.randomUUID(),
              payload: data.payload ?? {},
            }];
          });
          pendingRef.current = "";

        } else if (data.type === "done") {
          pendingRef.current = "";
          setMessages((prev) =>
            prev.map((m) => (m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m))
          );
          stopStreaming();

        } else if (data.type === "error") {
          setError(data.message || "Agent error");
          stopStreaming();
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, !!token]);

  // Scroll to bottom only for new incoming messages, not when prepending older ones
  useEffect(() => {
    if (shouldScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !token) return;

    const remaining = 10 - attachedFiles.length;
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      setError(`Max 10 files. Only the first ${remaining} were added.`);
    }

    setUploading(true);
    setError((prev) => (files.length > remaining ? prev : null));
    const apiBase = getApiBase();

    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`${apiBase}/api/v1/agent/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Upload failed: ${res.status}`);
          }
          const data = await res.json() as { file_id: string; url: string; type: string; filename: string };
          return {
            fileId: data.file_id,
            url: data.url,
            type: data.type as "image" | "csv",
            filename: data.filename,
          } satisfies AttachedFile;
        })
      );
      setAttachedFiles((prev) => [...prev, ...results]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProductPicked = (product: ProductPickerItem) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    const msg = `I meant the product: "${product.name}" (ID: ${product.id}). Please continue with this product.`;
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: msg, id: crypto.randomUUID() }]);
    startStreaming();
    wsRef.current.send(JSON.stringify({ type: "message", content: msg }));
  };

  const handleMultiProductPicked = (products: ProductPickerItem[]) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    const list = products.map((p) => `"${p.name}" (ID: ${p.id})`).join(", ");
    const msg = `I selected these products: ${list}. Please continue with all of them.`;
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: msg, id: crypto.randomUUID() }]);
    startStreaming();
    wsRef.current.send(JSON.stringify({ type: "message", content: msg }));
  };

  // Arm a 45s safety timeout to unlock the input if the agent never responds
  const startStreaming = () => {
    if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
    setStreaming(true);
    streamingTimeoutRef.current = setTimeout(() => {
      stopStreaming();
      pendingRef.current = "";
      setMessages((prev) =>
        prev.map((m) => (m.id === "streaming" ? { ...m, id: crypto.randomUUID() } : m))
      );
    }, 45000);
  };

  const stopStreaming = () => {
    if (streamingTimeoutRef.current) clearTimeout(streamingTimeoutRef.current);
    streamingTimeoutRef.current = null;
    stopStreaming();
  };

  const handleAction = (message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: message, id: crypto.randomUUID() }]);
    startStreaming();
    wsRef.current.send(JSON.stringify({ type: "message", content: message }));
  };

  const send = () => {
    const text = input.trim();
    const hasFiles = attachedFiles.length > 0;
    if ((!text && !hasFiles) || streaming || !wsRef.current || wsRef.current.readyState !== 1) return;

    // Display: show image files as actual images, CSV as chip
    const imageUrls = attachedFiles.filter((f) => f.type === "image").map((f) => f.url);
    const csvChips = attachedFiles.filter((f) => f.type === "csv").map((f) => `📎 ${f.filename}`).join(" ");
    // Combine: text + image URLs (renderMessageContent will convert to <img>) + csv chips
    const displayParts = [
      text,
      ...imageUrls,
      csvChips,
    ].filter(Boolean);
    const displayContent = displayParts.join("\n").trim();

    const filesToSend = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);
    setError(null);
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: displayContent, id: crypto.randomUUID() }]);
    startStreaming();

    // Send file metadata separately from text so backend can build the right prompt
    wsRef.current.send(JSON.stringify({
      type: "message",
      content: text || `Please process the attached file${filesToSend.length > 1 ? "s" : ""}: ${filesToSend.map((f) => f.filename).join(", ")}`,
      ...(hasFiles ? {
        files: filesToSend.map((f) => ({
          url: f.url,
          type: f.type,
          filename: f.filename,
          file_id: f.fileId,
        })),
      } : {}),
    }));
  };

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-600", emerald: "bg-emerald-600",
    rose: "bg-rose-600", amber: "bg-amber-600",
  };
  const agentColor = colorMap[agent.color] || "bg-gray-600";

  // Render message content — strip base64 blobs, replace image URLs with <img>
  const renderMessageContent = (content: string) => {
    const cleaned = content
      .replace(/data:[^;]+;base64,[A-Za-z0-9+/=\n]{50,}/g, "")
      .replace(/\[image\]/g, "")
      .trim();
    if (!cleaned) return null;

    // Split on any https URL that looks like an image (by extension or by upload path)
    const urlRegex = /(https?:\/\/[^\s]+(?:\.(?:jpg|jpeg|png|webp|gif|avif|svg)(?:\?[^\s]*)?|\/uploads\/[^\s]+|\/agent\/upload[^\s]*))/gi;
    const parts = cleaned.split(urlRegex);

    if (parts.length === 1) return cleaned;

    return parts.map((part, i) => {
      if (/^https?:\/\//i.test(part) && (
        /\.(jpg|jpeg|png|webp|gif|avif|svg)/i.test(part) ||
        part.includes("/uploads/") ||
        part.includes("railway")
      )) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={part} alt="Uploaded image" className="max-w-full rounded-xl mt-2 object-contain max-h-64 bg-gray-50" />
        );
      }
      return part || null;
    });
  };

  // Insert date dividers between messages from different days
  const renderMessages = () => {
    const nodes: React.ReactNode[] = [];
    let lastDate = "";

    messages.forEach((msg) => {
      const msgDate = msg.created_at
        ? new Date(msg.created_at).toDateString()
        : "";
      if (msgDate && msgDate !== lastDate) {
        nodes.push(<DateDivider key={`div-${msgDate}`} date={msg.created_at!} />);
        lastDate = msgDate;
      }

      if (msg.role === "task_created") {
        nodes.push(
          <div key={msg.id} className="flex justify-start">
            <div className={`w-6 h-6 rounded-full ${agentColor} flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0`}>
              {agent.name[0]}
            </div>
            <div className="max-w-[78%]">
              <TaskCreatedCard payload={msg.payload ?? {}} />
            </div>
          </div>
        );
      } else if (msg.role === "a2ui") {
        nodes.push(
          <div key={msg.id} className="flex justify-start">
            <div className={`w-6 h-6 rounded-full ${agentColor} flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0`}>
              {agent.name[0]}
            </div>
            <div className="max-w-[78%]">
              <A2UICard payload={msg.payload ?? {}} onProductPicked={handleProductPicked} onMultiProductPicked={handleMultiProductPicked} onAction={handleAction} />
            </div>
          </div>
        );
      } else {
        nodes.push(
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className={`w-6 h-6 rounded-full ${agentColor} flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0`}>
                {agent.name[0]}
              </div>
            )}
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-tr-sm"
                : "bg-white border shadow-sm rounded-tl-sm"
            }`}>
              {renderMessageContent(msg.content)}
              {msg.id === "streaming" && (
                <span className="inline-block w-1.5 h-3.5 bg-gray-400 animate-pulse ml-1 rounded-sm align-middle" />
              )}
            </div>
          </div>
        );
      }
    });

    return nodes;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-white">
        <div className={`w-9 h-9 rounded-full ${agentColor} flex items-center justify-center text-lg shrink-0`}>
          {agent.icon}
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-gray-900 leading-tight">{agent.name}</h1>
          <p className="text-xs text-gray-500 truncate">{agent.tagline}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full shrink-0 ${connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
          {connected ? "● Online" : "○ Connecting"}
        </span>
      </div>

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-400 animate-pulse">Loading conversation...</span>
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <AgentWelcome agent={agent} agentColor={agentColor} onExample={setInput} />
        )}

        {/* Load earlier messages button — only shown when there's history above */}
        {historyLoaded && hasMore && messages.length > 0 && (
          <div className="flex justify-center pt-1 pb-2">
            <button
              onClick={loadMoreMessages}
              disabled={loadingMore}
              className="text-xs px-4 py-1.5 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:border-gray-300 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loadingMore ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Loading…
                </span>
              ) : "↑ Load earlier messages"}
            </button>
          </div>
        )}

        {historyLoaded && renderMessages()}

        {error && <p className="text-center text-xs text-red-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 bg-white">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 px-1">
            {attachedFiles.map((f) => (
              <span
                key={f.fileId}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
              >
                📎 {f.filename}
                <button
                  onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.fileId !== f.fileId))}
                  className="ml-1 text-blue-500 hover:text-blue-700 font-bold"
                  aria-label={`Remove ${f.filename}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.csv,text/csv"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || !connected || uploading || attachedFiles.length >= 10}
            className="px-3 py-2 border rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-40 transition-colors text-sm"
            title={attachedFiles.length >= 10 ? "Max 10 files" : "Attach image or CSV (up to 10)"}
          >
            {uploading ? "⏳" : "📎"}
          </button>
          <input
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            placeholder={connected ? `Message ${agent.name}...` : "Connecting..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            disabled={streaming || !connected}
          />
          <button
            onClick={send}
            disabled={streaming || !connected || (!input.trim() && attachedFiles.length === 0)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {streaming ? "●●●" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
