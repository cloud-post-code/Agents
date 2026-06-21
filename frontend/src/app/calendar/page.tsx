"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
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

const AGENT_COLORS: Record<string, string> = {
  strategist: "bg-indigo-100 text-indigo-800 border-indigo-200",
  product_manager: "bg-emerald-100 text-emerald-800 border-emerald-200",
  marketer: "bg-rose-100 text-rose-800 border-rose-200",
  admin: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function CalendarPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", starts_at: "", description: "" });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const load = () => {
    if (!token) return;
    const start = startOfMonth.toISOString().replace(/\+.*/, "Z");
    const end = endOfMonth.toISOString().replace(/\+.*/, "Z");
    apiFetch<{ events: CalEvent[] }>(`/api/v1/calendar/events?start=${start}&end=${end}`, token)
      .then((d) => setEvents(d.events))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

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
      load();
    } finally { setSaving(false); }
  };

  // Group events by date
  const grouped = events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    const day = e.starts_at.split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  const month = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{month}</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
          >
            + Add Event
          </button>
        </div>

        {showAdd && (
          <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
            <h2 className="font-semibold mb-3">New Event</h2>
            <div className="space-y-2">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="flex gap-2">
                <button onClick={addEvent} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 border text-sm rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
            <p className="text-2xl mb-2">📅</p>
            <p>No events this month</p>
            <p className="text-sm mt-1">Your agents will schedule events here, or add your own</p>
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
                      <div className="text-xs text-gray-400 w-12 shrink-0 mt-0.5">
                        {ev.all_day ? "All day" : new Date(ev.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                      </div>
                      {ev.created_by && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${AGENT_COLORS[ev.created_by] || "bg-gray-100 text-gray-600"}`}>
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
      </main>
    </div>
  );
}
