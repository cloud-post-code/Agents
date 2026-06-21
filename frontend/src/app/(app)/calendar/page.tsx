"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_by: string | null;
}

const AGENT_CHIP: Record<string, string> = {
  strategist: "bg-indigo-100 text-indigo-700",
  product_manager: "bg-emerald-100 text-emerald-700",
  marketer: "bg-rose-100 text-rose-700",
  admin: "bg-amber-100 text-amber-700",
};


function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {["Today", "Tomorrow", "Jun 28"].map((d) => (
        <div key={d} className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          <div className="divide-y">
            {[1, 2].map((i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="w-12 h-3 bg-gray-100 rounded mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const { token, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", starts_at: "", description: "" });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split(".")[0] + "Z";
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString().split(".")[0] + "Z";

  const load = (tok: string) => {
    setFetching(true);
    apiFetch<{ events: CalEvent[] }>(`/api/v1/calendar/events?start=${startOfMonth}&end=${endOfMonth}`, tok)
      .then((d) => setEvents(d.events))
      .catch(console.error)
      .finally(() => { setFetching(false); setFetched(true); });
  };

  useEffect(() => {
    if (!authLoading && token) load(token);
    else if (!authLoading && !token) setFetched(true);
  }, [authLoading, token]);

  const addEvent = async () => {
    if (!token || !form.title || !form.starts_at) return;
    setSaving(true);
    try {
      await apiFetch("/api/v1/calendar/events", token, {
        method: "POST",
        body: JSON.stringify({ ...form, starts_at: new Date(form.starts_at).toISOString() }),
      });
      setForm({ title: "", starts_at: "", description: "" });
      setShowAdd(false);
      load(token);
    } finally { setSaving(false); }
  };

  const grouped = events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    const day = e.starts_at.split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  const showSkeleton = authLoading || (fetching && !fetched);
  const month = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{month}</h1>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">
          + Add Event
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="font-semibold mb-3">New Event</h2>
          <div className="space-y-2">
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Event title"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="datetime-local" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description (optional)"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={addEvent} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSkeleton ? (
        <Skeleton />
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No events this month.</p>
          <p className="text-xs mt-1">Add an event or let your AI team schedule one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort().map(([date, dayEvents]) => (
            <div key={date} className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b">
                <p className="text-sm font-semibold text-gray-700">
                  {new Date(date + "T12:00:00").toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="divide-y">
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs text-gray-400 w-16 shrink-0 mt-0.5">
                      {ev.all_day ? "All day" : new Date(ev.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.description && <p className="text-xs text-gray-400 mt-0.5">{ev.description}</p>}
                    </div>
                    {ev.created_by && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${AGENT_CHIP[ev.created_by] || "bg-gray-100 text-gray-500"}`}>
                        {ev.created_by.replace("_", " ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
