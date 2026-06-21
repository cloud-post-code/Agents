"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  created_by: string;
  priority: number;
  due_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-gray-100 text-gray-600",
};

export default function TasksPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    apiFetch<{ items: Task[] }>("/api/v1/tasks", token)
      .then((d) => setTasks(d.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const approve = async (id: string) => {
    setActing(id);
    try {
      await apiFetch(`/api/v1/tasks/${id}/approve`, token!, { method: "POST" });
      load();
    } finally { setActing(null); }
  };

  const reject = async (id: string) => {
    setActing(id);
    try {
      await apiFetch(`/api/v1/tasks/${id}/reject`, token!, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectId(null);
      setRejectReason("");
      load();
    } finally { setActing(null); }
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const others = tasks.filter((t) => t.status !== "pending");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <h1 className="text-2xl font-bold mb-6">Task Queue</h1>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
            <p className="text-lg">No tasks yet</p>
            <p className="text-sm mt-1">Your AI co-workers will queue tasks here for your approval</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Needs Approval ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((task) => (
                    <div key={task.id} className="bg-white border-l-4 border-yellow-400 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          {task.description && <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>}
                          <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                            <span>Created by: {task.created_by || "agent"}</span>
                            {task.due_at && <span>Due: {new Date(task.due_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => approve(task.id)}
                            disabled={!!acting}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {acting === task.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectId(task.id)}
                            disabled={!!acting}
                            className="px-3 py-1.5 bg-white border text-sm rounded-lg hover:bg-red-50 text-red-600 border-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                      {rejectId === task.id && (
                        <div className="mt-3 flex gap-2">
                          <input
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <button onClick={() => reject(task.id)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg">
                            Confirm Reject
                          </button>
                          <button onClick={() => setRejectId(null)} className="px-3 py-1.5 border text-sm rounded-lg">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">History</h2>
                <div className="space-y-2">
                  {others.map((task) => (
                    <div key={task.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(task.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status] || "bg-gray-100"}`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
