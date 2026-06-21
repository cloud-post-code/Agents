"use client";

import { useEffect, useState } from "react";
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
  task_pending_approval: "📋", task_approved: "✅", task_rejected: "❌",
  report_ready: "📄", agent_message: "💬", sync_error: "⚠️", low_stock: "📦",
};
const TYPE_LABELS: Record<string, string> = {
  task_pending_approval: "Task needs your approval",
  task_approved: "Task approved",
  task_rejected: "Task rejected",
  report_ready: "Report is ready to download",
  agent_message: "Message from agent",
  sync_error: "Facebook sync error",
  low_stock: "Low stock alert",
};

const EXAMPLE_NOTIFS = [
  { icon: "📋", label: "Task needs your approval", sub: "Review Q3 pricing strategy", unread: true, time: "2 min ago" },
  { icon: "📄", label: "Report is ready to download", sub: "Business Health Summary — June 2026", unread: true, time: "1 hr ago" },
  { icon: "📦", label: "Low stock alert", sub: "Ceramic Bowl (CB-001) — 3 units remaining", unread: false, time: "Yesterday" },
  { icon: "✅", label: "Task approved", sub: "Restock ceramic bowls — 50 units ordered", unread: false, time: "2 days ago" },
];

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1,2,3,4].map((i) => (
        <div key={i} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${i <= 2 ? "border-l-4 border-l-blue-200" : ""}`}>
          <div className="w-8 h-8 bg-gray-200 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
          {i <= 2 && <div className="w-2 h-2 bg-blue-200 rounded-full mt-1.5" />}
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const { token, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = (tok: string) => {
    setFetching(true);
    apiFetch<{ items: Notification[] }>("/api/v1/notifications", tok)
      .then((d) => setNotifications(d.items))
      .catch(console.error)
      .finally(() => { setFetching(false); setFetched(true); });
  };

  useEffect(() => {
    if (!authLoading && token) load(token);
    else if (!authLoading && !token) setFetched(true);
  }, [authLoading, token]);

  const markRead = async (id: string) => {
    if (!token) return;
    await apiFetch(`/api/v1/notifications/${id}/read`, token, { method: "POST" });
    load(token);
  };
  const markAllRead = async () => {
    if (!token) return;
    await apiFetch("/api/v1/notifications/read-all", token, { method: "POST" });
    load(token);
  };

  const unread = notifications.filter((n) => !n.read_at);
  const showSkeleton = authLoading || (fetching && !fetched);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="text-sm text-blue-600 hover:underline">
            Mark all read
          </button>
        )}
      </div>

      {showSkeleton ? (
        <Skeleton />
      ) : notifications.length === 0 ? (
        <div className="opacity-40 pointer-events-none select-none space-y-2">
          {EXAMPLE_NOTIFS.map((n, i) => (
            <div key={i} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${n.unread ? "border-l-4 border-l-blue-500" : ""}`}>
              <span className="text-xl mt-0.5">{n.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${n.unread ? "text-gray-900" : "text-gray-500"}`}>{n.label}</p>
                <p className="text-sm text-gray-400 mt-0.5">{n.sub}</p>
                <p className="text-xs text-gray-300 mt-1">{n.time}</p>
              </div>
              {n.unread && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer hover:shadow-sm transition-shadow ${!n.read_at ? "border-l-4 border-l-blue-500" : ""}`}
              onClick={() => !n.read_at && markRead(n.id)}>
              <span className="text-xl mt-0.5">{TYPE_ICONS[n.type] || "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.read_at ? "text-gray-500" : "text-gray-900"}`}>
                  {TYPE_LABELS[n.type] || n.type}
                </p>
                {n.payload?.title && <p className="text-sm text-gray-400 mt-0.5 truncate">{n.payload.title}</p>}
                {n.payload?.product_name && <p className="text-sm text-gray-400 mt-0.5">{n.payload.product_name} — {n.payload.stock_qty} remaining</p>}
                <p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
