"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, getApiBase } from "@/lib/api";

interface Report {
  id: string;
  title: string;
  template_id: string;
  format: string;
  status: string;
  size_bytes: number | null;
  created_at: string;
  storage_url: string | null;
}

const TEMPLATES = [
  { id: "business_health_summary", label: "Business Health Summary", agent: "Strategist" },
  { id: "revenue_over_time", label: "Revenue Over Time", agent: "Strategist" },
  { id: "gross_profit_by_product", label: "Gross Profit by Product", agent: "Strategist" },
  { id: "orders_log", label: "Orders Log", agent: "Admin" },
  { id: "order_line_items", label: "Order Line Items", agent: "Admin" },
  { id: "monthly_financial_statement", label: "Monthly Financial Statement", agent: "Admin" },
  { id: "fulfillment_performance", label: "Fulfillment Performance", agent: "Admin" },
  { id: "inventory_health", label: "Inventory Health", agent: "Product Manager" },
  { id: "inventory_movement", label: "Inventory Movement", agent: "Product Manager" },
  { id: "product_performance", label: "Product Performance", agent: "Marketer" },
  { id: "traffic_sources", label: "Traffic Sources", agent: "Marketer" },
  { id: "conversion_funnel", label: "Conversion Funnel", agent: "Marketer" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-50",
  complete: "text-green-700 bg-green-50",
  failed: "text-red-500 bg-red-50",
};

const EXAMPLE_REPORTS = [
  { title: "Business Health Summary", agent: "Strategist", date: "Today, 9:00 AM", size: "84 KB", status: "complete" },
  { title: "Inventory Health", agent: "Product Manager", date: "Today, 9:01 AM", size: "62 KB", status: "complete" },
  { title: "Orders Log — June 2026", agent: "Admin", date: "Yesterday", size: "128 KB", status: "complete" },
  { title: "Product Performance", agent: "Marketer", date: "Jun 19", size: "91 KB", status: "complete" },
];

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1,2,3,4].map((i) => (
        <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="flex gap-3">
              <div className="h-3 bg-gray-100 rounded w-20" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          </div>
          <div className="h-8 w-24 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { token, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = (tok: string) => {
    setFetching(true);
    apiFetch<{ items: Report[] }>("/api/v1/reports", tok)
      .then((d) => setReports(d.items))
      .catch(console.error)
      .finally(() => { setFetching(false); setFetched(true); });
  };

  useEffect(() => {
    if (!authLoading && token) load(token);
    else if (!authLoading && !token) setFetched(true);
  }, [authLoading, token]);

  const generate = async (template_id: string) => {
    if (!token) return;
    setGenerating(template_id);
    try {
      await apiFetch("/api/v1/reports/generate", token, {
        method: "POST",
        body: JSON.stringify({ template_id, params: {} }),
      });
      setShowGenerate(false);
      setTimeout(() => load(token), 2000);
    } finally { setGenerating(null); }
  };

  const download = (report: Report) => {
    if (!token) return;
    fetch(`${getApiBase()}/api/v1/reports/${report.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.blob()).then((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${report.template_id || "report"}.pdf`;
      link.click();
    });
  };

  const showSkeleton = authLoading || (fetching && !fetched);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <button onClick={() => setShowGenerate(!showGenerate)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">
          + Generate Report
        </button>
      </div>

      {showGenerate && (
        <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="font-semibold mb-3">Choose a report</h2>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => generate(t.id)} disabled={!!generating}
                className="text-left px-3 py-2.5 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-gray-400">{t.agent}</p>
              </button>
            ))}
          </div>
          {generating && <p className="text-sm text-blue-600 mt-3 animate-pulse">Generating report…</p>}
        </div>
      )}

      {showSkeleton ? (
        <Skeleton />
      ) : reports.length === 0 ? (
        <div className="opacity-40 pointer-events-none select-none space-y-2">
          {EXAMPLE_REPORTS.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{r.title}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{r.agent}</span>
                  <span>{r.date}</span>
                  <span>{r.size}</span>
                </div>
              </div>
              <button className="px-3 py-1.5 border text-sm rounded-lg text-blue-600">↓ Download</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{r.title}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-50 text-gray-400"}`}>
                    {r.status}
                  </span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  {r.size_bytes && <span>{(r.size_bytes / 1024).toFixed(0)} KB</span>}
                </div>
              </div>
              {r.status === "complete" && r.storage_url ? (
                <button onClick={() => download(r)}
                  className="px-3 py-1.5 border text-sm rounded-lg text-blue-600 hover:bg-blue-50">
                  ↓ Download
                </button>
              ) : r.status === "pending" ? (
                <span className="text-xs text-yellow-600 animate-pulse">Generating…</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
