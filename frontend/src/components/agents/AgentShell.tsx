"use client";

import { useState, useEffect, useRef } from "react";
import { AgentConfig } from "@/lib/agents";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, getApiBase } from "@/lib/api";

type MessageKind = "user" | "assistant" | "task_created" | "a2ui";

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

function A2UICard({ payload }: { payload: Record<string, unknown> }) {
  const surface = String(payload.surface ?? payload.component ?? "surface");
  const props = (payload.props ?? {}) as Record<string, unknown>;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide">
          {surface}
        </span>
      </div>
      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto bg-white rounded-lg p-3 border border-blue-100">
        {JSON.stringify(props, null, 2)}
      </pre>
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

export function AgentShell({ agent }: AgentShellProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>("");
  const tokenRef = useRef<string | null>(null);
  const roleRef = useRef<string>(agent.role);

  tokenRef.current = token;
  roleRef.current = agent.role;

  // Load full chat history on mount
  useEffect(() => {
    if (!token) return;
    apiFetch<{ session_id: string; role: string; messages: HistoryMessage[] }>(
      `/api/v1/agents/${agent.role}/history?limit=200`,
      token
    )
      .then((data) => {
        const loaded: Message[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as MessageKind,
            content: m.content,
            created_at: m.created_at,
          }));
        setMessages(loaded);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true)); // fail open — show empty thread
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, agent.role]);

  // Connect WebSocket after history is loaded
  useEffect(() => {
    if (!token || !historyLoaded) return;

    const base = getApiBase().replace(/^https/, "wss").replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/ws/agent/${roleRef.current}/chat`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }));
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => setError("Connection lost. Refresh to retry.");

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "session_id") {
        // session confirmed — nothing to show
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
        setStreaming(false);

      } else if (data.type === "error") {
        setError(data.message || "Agent error");
        setStreaming(false);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, !!token]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming || !wsRef.current || wsRef.current.readyState !== 1) return;
    setInput("");
    setError(null);
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: text, id: crypto.randomUUID() }]);
    setStreaming(true);
    wsRef.current.send(JSON.stringify({ type: "message", content: text }));
  };

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-600", emerald: "bg-emerald-600",
    rose: "bg-rose-600", amber: "bg-amber-600",
  };
  const agentColor = colorMap[agent.color] || "bg-gray-600";

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
              <A2UICard payload={msg.payload ?? {}} />
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
              {msg.content}
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
      <div className="border-b p-4 flex items-center gap-3 bg-white">
        <div className={`w-9 h-9 rounded-full ${agentColor} flex items-center justify-center text-white font-bold`}>
          {agent.name[0]}
        </div>
        <div>
          <h1 className="font-semibold">{agent.name}</h1>
          <p className="text-xs text-gray-500">{agent.description}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
          {connected ? "● Online" : "○ Connecting"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-400 animate-pulse">Loading conversation...</span>
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className={`w-16 h-16 rounded-full ${agentColor} flex items-center justify-center text-white text-2xl font-bold`}>
              {agent.name[0]}
            </div>
            <p className="text-gray-500 text-sm mt-2">Hi! I&apos;m your {agent.name}.</p>
            <p className="text-gray-400 text-sm">{agent.description}</p>
          </div>
        )}

        {historyLoaded && renderMessages()}

        {error && <p className="text-center text-xs text-red-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 bg-white">
        <div className="flex gap-2">
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
            disabled={streaming || !connected || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {streaming ? "●●●" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
