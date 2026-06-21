"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  created_by: string | null;
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
  failed: "bg-gray-100 text-gray-500",
};

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {/* Pending section */}
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Needs Approval (2)</p>
      {[
        { title: "Review Q3 pricing strategy", agent: "Strategist", due: "Tomorrow" },
        { title: "Update Etsy listing descriptions for holiday season", agent: "Marketer", due: "Jun 25" },
      ].map((t, i) => (
        <div key={i} className="bg-white border-l-4 border-yellow-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="flex gap-3">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-gray-200 rounded-lg" />
              <div className="h-8 w-16 bg-gray-100 rounded-lg" />
            </div>
          </div>
        </div>
      ))}

      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mt-6">History</p>
      {[
        { status: "completed" }, { status: "approved" }, { status: "rejected" },
      ].map((t, i) => (
        <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function TasksPage() {
  const { token, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = (tok: string) => {
    setFetching(true);
    apiFetch<{ items: Task[] }>("/api/v1/tasks", tok)
      .then((d) => setTasks(d.items ?? []))
      .catch(console.error)
      .finally(() => { setFetching(false); setFetched(true); });
  };

  useEffect(() => {
    if (!authLoading && token) load(token);
    else if (!authLoading && !token) setFetched(true);
  }, [authLoading, token]);

  const approve = async (id: string) => {
    if (!token) return;
    setActing(id);
    try {
      await apiFetch(`/api/v1/tasks/${id}/approve`, token, { method: "POST" });
      load(token);
    } finally { setActing(null); }
  };

  const reject = async (id: string) => {
    if (!token) return;
    setActing(id);
    try {
      await apiFetch(`/api/v1/tasks/${id}/reject`, token, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectId(null); setRejectReason(""); load(token);
    } finally { setActing(null); }
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const others = tasks.filter((t) => t.status !== "pending");

  const showSkeleton = authLoading || (fetching && !fetched);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Task Queue</h1>

      {showSkeleton ? (
        <Skeleton />
      ) : tasks.length === 0 ? (
        // Empty state that looks like the real thing — greyed out example
        <div className="opacity-40 pointer-events-none select-none">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Needs Approval</p>
          <div className="bg-white border-l-4 border-yellow-400 rounded-xl p-4 shadow-sm mb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Review Q3 pricing strategy</p>
                <p className="text-sm text-gray-500 mt-0.5">Strategist recommends 8% price increase on ceramic line</p>
                <p className="text-xs text-gray-400 mt-1">Created by: strategist · Due: tomorrow</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg">Approve</button>
                <button className="px-3 py-1.5 border text-sm rounded-lg text-red-600 border-red-200">Reject</button>
              </div>
            </div>
          </div>
          <div className="bg-white border-l-4 border-yellow-400 rounded-xl p-4 shadow-sm mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Update holiday listing descriptions</p>
                <p className="text-sm text-gray-500 mt-0.5">Marketer drafted SEO-optimised copy for 12 products</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg">Approve</button>
                <button className="px-3 py-1.5 border text-sm rounded-lg text-red-600 border-red-200">Reject</button>
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">History</p>
          {["Restocked ceramic bowls — 50 units", "Published new Etsy listings (8)", "Updated shipping rates"].map((t, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between mb-2">
              <p className="font-medium text-sm">{t}</p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800">completed</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Needs Approval ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((task) => (
                  <div key={task.id} className="bg-white border-l-4 border-yellow-400 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{task.title}</p>
                        {task.description && <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          {task.created_by && <span>Created by: {task.created_by}</span>}
                          {task.due_at && <span>Due: {new Date(task.due_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => approve(task.id)} disabled={!!acting}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {acting === task.id ? "…" : "Approve"}
                        </button>
                        <button onClick={() => setRejectId(task.id)} disabled={!!acting}
                          className="px-3 py-1.5 border text-sm rounded-lg text-red-600 border-red-200 hover:bg-red-50">
                          Reject
                        </button>
                      </div>
                    </div>
                    {rejectId === task.id && (
                      <div className="mt-3 flex gap-2">
                        <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                          placeholder="Reason (optional)" value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)} />
                        <button onClick={() => reject(task.id)}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg">Confirm</button>
                        <button onClick={() => setRejectId(null)}
                          className="px-3 py-1.5 border text-sm rounded-lg">Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">History</h2>
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
    </div>
  );
}
