"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
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
  { id: "orders_log", label: "Orders Log", agent: "Admin" },
  { id: "order_line_items", label: "Order Line Items", agent: "Admin" },
  { id: "monthly_financial_statement", label: "Monthly Financial Statement", agent: "Admin" },
  { id: "fulfillment_performance", label: "Fulfillment Performance", agent: "Admin" },
  { id: "inventory_health", label: "Inventory Health", agent: "Product Manager" },
  { id: "inventory_movement", label: "Inventory Movement", agent: "Product Manager" },
  { id: "revenue_over_time", label: "Revenue Over Time", agent: "Strategist" },
  { id: "gross_profit_by_product", label: "Gross Profit by Product", agent: "Strategist" },
  { id: "product_performance", label: "Product Performance", agent: "Marketer" },
  { id: "traffic_sources", label: "Traffic Sources", agent: "Marketer" },
  { id: "conversion_funnel", label: "Conversion Funnel", agent: "Marketer" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600",
  complete: "text-green-600",
  failed: "text-red-500",
};

export default function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = () => {
    if (!token) return;
    apiFetch<{ items: Report[] }>("/api/v1/reports", token)
      .then((d) => setReports(d.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const generate = async (template_id: string) => {
    if (!token) return;
    setGenerating(template_id);
    try {
      await apiFetch("/api/v1/reports/generate", token, {
        method: "POST",
        body: JSON.stringify({ template_id, params: {} }),
      });
      setShowGenerate(false);
      setTimeout(load, 2000);
    } finally { setGenerating(null); }
  };

  const download = (report: Report) => {
    const url = `${getApiBase()}/api/v1/reports/${report.id}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("Authorization", `Bearer ${token}`);
    // Use fetch with auth header for download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${report.template_id || "report"}.pdf`;
        link.click();
      });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Reports</h1>
          <button
            onClick={() => setShowGenerate(!showGenerate)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
          >
            Generate Report
          </button>
        </div>

        {showGenerate && (
          <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm">
            <h2 className="font-semibold mb-3">Choose a report to generate</h2>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => generate(t.id)}
                  disabled={generating === t.id}
                  className="text-left px-3 py-2.5 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-gray-400">{t.agent}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
            <p className="text-2xl mb-2">📊</p>
            <p>No reports yet</p>
            <p className="text-sm mt-1">Generate your first report above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                    <span className={STATUS_COLORS[r.status] || "text-gray-400"}>{r.status}</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    {r.size_bytes && <span>{(r.size_bytes / 1024).toFixed(0)} KB</span>}
                  </div>
                </div>
                {r.status === "complete" && r.storage_url && (
                  <button
                    onClick={() => download(r)}
                    className="px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-50 text-blue-600"
                  >
                    ↓ Download
                  </button>
                )}
                {r.status === "pending" && (
                  <span className="text-xs text-yellow-600 animate-pulse">Generating...</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
