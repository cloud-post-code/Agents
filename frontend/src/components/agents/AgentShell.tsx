"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AgentConfig } from "@/lib/agents";
import { useAuth } from "@/hooks/useAuth";
import { getApiBase } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

interface AgentShellProps {
  agent: AgentConfig;
}

export function AgentShell({ agent }: AgentShellProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>("");

  const connect = useCallback(() => {
    if (!token) return;
    const base = getApiBase().replace(/^https/, "wss").replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/ws/agent/${agent.role}/chat`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: "auth", token }));
    };
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onerror = () => setError("Connection lost");

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "token") {
        pendingRef.current += data.content;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            return [...prev.slice(0, -1), { ...last, content: pendingRef.current }];
          }
          return [...prev, { role: "assistant", content: pendingRef.current, id: "streaming" }];
        });
      } else if (data.type === "done") {
        pendingRef.current = "";
        setMessages((prev) =>
          prev.map((m) => m.id === "streaming" ? { ...m, id: Date.now().toString() } : m)
        );
        setStreaming(false);
      } else if (data.type === "error") {
        setError(data.message || "Agent error");
        setStreaming(false);
      }
    };

    wsRef.current = ws;
  }, [token, agent.role]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming || !wsRef.current || wsRef.current.readyState !== 1) return;
    setInput("");
    setError(null);
    pendingRef.current = "";
    setMessages((prev) => [...prev, { role: "user", content: text, id: Date.now().toString() }]);
    setStreaming(true);
    wsRef.current.send(JSON.stringify({ type: "message", content: text }));
  };

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-600", emerald: "bg-emerald-600",
    rose: "bg-rose-600", amber: "bg-amber-600",
  };
  const agentColor = colorMap[agent.color] || "bg-gray-600";

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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className={`w-16 h-16 rounded-full ${agentColor} flex items-center justify-center text-white text-2xl font-bold`}>
              {agent.name[0]}
            </div>
            <p className="text-gray-500 text-sm mt-2">Hi! I'm your {agent.name}.</p>
            <p className="text-gray-400 text-sm">{agent.description}</p>
          </div>
        )}
        {messages.map((msg) => (
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
        ))}
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
