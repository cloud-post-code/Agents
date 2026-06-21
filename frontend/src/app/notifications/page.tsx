"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  task_pending_approval: "📋",
  task_approved: "✅",
  task_rejected: "❌",
  report_ready: "📄",
  agent_message: "💬",
  sync_error: "⚠️",
  low_stock: "📦",
};

const TYPE_LABELS: Record<string, string> = {
  task_pending_approval: "Task needs approval",
  task_approved: "Task approved",
  task_rejected: "Task rejected",
  report_ready: "Report ready",
  agent_message: "Agent message",
  sync_error: "Sync error",
  low_stock: "Low stock alert",
};

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!token) return;
    apiFetch<{ items: Notification[] }>("/api/v1/notifications", token)
      .then((d) => setNotifications(d.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const markRead = async (id: string) => {
    if (!token) return;
    await apiFetch(`/api/v1/notifications/${id}/read`, token, { method: "POST" });
    load();
  };

  const markAllRead = async () => {
    if (!token) return;
    await apiFetch("/api/v1/notifications/read-all", token, { method: "POST" });
    load();
  };

  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread.length > 0 && (
            <button onClick={markAllRead} className="text-sm text-blue-600 hover:underline">
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
            <p className="text-2xl mb-2">🔔</p>
            <p>You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer hover:shadow-sm transition-shadow ${!n.read_at ? "border-l-4 border-l-blue-500" : ""}`}
                onClick={() => !n.read_at && markRead(n.id)}
              >
                <span className="text-xl mt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.read_at ? "text-gray-600" : "text-gray-900"}`}>
                    {TYPE_LABELS[n.type] || n.type}
                  </p>
                  {n.payload?.title && <p className="text-sm text-gray-500 mt-0.5 truncate">{n.payload.title}</p>}
                  {n.payload?.product_name && <p className="text-sm text-gray-500 mt-0.5">{n.payload.product_name} — {n.payload.stock_qty} remaining</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
