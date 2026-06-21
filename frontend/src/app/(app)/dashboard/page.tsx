"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

const AGENT_COLORS: Record<string, string> = {
  indigo: "border-l-indigo-500 hover:bg-indigo-50",
  emerald: "border-l-emerald-500 hover:bg-emerald-50",
  rose: "border-l-rose-500 hover:bg-rose-50",
  amber: "border-l-amber-500 hover:bg-amber-50",
};

const AGENT_DOT: Record<string, string> = {
  indigo: "bg-indigo-500", emerald: "bg-emerald-500",
  rose: "bg-rose-500", amber: "bg-amber-500",
};

export default function DashboardPage() {
  const { user, tenant, token } = useAuth();
  const [pendingTasks, setPendingTasks] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<Array<{ id: string; type: string; created_at: string }>>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ items: Array<{ status: string }> }>("/api/v1/tasks?page_size=50", token)
      .then((d) => setPendingTasks((d.items ?? []).filter((t) => t.status === "pending").length))
      .catch(() => {});
    apiFetch<{ items: Array<{ id: string; type: string; read_at: string | null; created_at: string }> }>(
      "/api/v1/notifications?page_size=5", token
    ).then((d) => {
      setUnreadNotifs((d.items ?? []).filter((n) => !n.read_at).length);
      setRecentNotifs((d.items ?? []).slice(0, 3));
    }).catch(() => {});
  }, [token]);

  const TYPE_LABELS: Record<string, string> = {
    task_pending_approval: "📋 Task needs approval",
    report_ready: "📄 Report ready",
    low_stock: "📦 Low stock alert",
    sync_error: "⚠️ Sync error",
    agent_message: "💬 Agent message",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Good day{user ? `, ${user.email.split("@")[0]}` : ""}! 👋</h1>
        {tenant && <p className="text-gray-500 mt-0.5">{tenant.display_name}</p>}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/tasks" className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
          <p className="text-3xl font-bold text-yellow-600">{pendingTasks}</p>
          <p className="text-sm text-gray-500 mt-0.5">Tasks pending approval</p>
        </Link>
        <Link href="/notifications" className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
          <p className="text-3xl font-bold text-blue-600">{unreadNotifs}</p>
          <p className="text-sm text-gray-500 mt-0.5">Unread notifications</p>
        </Link>
      </div>

      {/* Agents */}
      <h2 className="font-semibold text-gray-700 mb-3">Your AI Team</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {AGENTS.map((agent) => (
          <Link
            key={agent.slug}
            href={`/agents/${agent.slug}`}
            className={`bg-white rounded-xl border-l-4 border border-gray-200 p-4 transition-colors ${AGENT_COLORS[agent.color]}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${AGENT_DOT[agent.color]}`} />
              <h3 className="font-semibold text-sm">{agent.name}</h3>
            </div>
            <p className="text-xs text-gray-500">{agent.description}</p>
          </Link>
        ))}
      </div>

      {/* Recent notifications */}
      {recentNotifs.length > 0 && (
        <>
          <h2 className="font-semibold text-gray-700 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recentNotifs.map((n) => (
              <div key={n.id} className="bg-white rounded-xl border p-3 flex items-center justify-between">
                <p className="text-sm">{TYPE_LABELS[n.type] || n.type}</p>
                <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
            <Link href="/notifications" className="block text-center text-xs text-blue-600 hover:underline py-1">
              View all →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
