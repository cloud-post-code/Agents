"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  reorder_point: number;
  weight_grams: number | null;
  image_url: string | null;
  created_at: string;
}

interface EditableFields {
  name?: string;
  price?: string;
  stock_qty?: string;
  sku?: string;
  reorder_point?: string;
}

type BulkAction = "price" | "stock" | "reorder" | "delete" | "discount";

function StockPill({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty === 0) return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-medium">Out of stock</span>;
  if (qty <= reorder) return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 font-medium">Low: {qty}</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">{qty} in stock</span>;
}

function InlineEdit({
  value,
  onSave,
  type = "text",
  prefix,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="group flex items-center gap-1 text-left hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
        title="Click to edit"
      >
        {prefix && <span className="text-gray-400 text-xs">{prefix}</span>}
        <span className="text-sm text-gray-700">{value || <span className="text-gray-300 italic">—</span>}</span>
        <span className="text-gray-300 text-xs opacity-0 group-hover:opacity-100">✎</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-gray-400 text-xs">{prefix}</span>}
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

export default function InventoryPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, EditableFields>>({});
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const PAGE_SIZE = 25;

  const load = useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Product[]; page: number }>(
        `/api/v1/products?page=${p}&page_size=${PAGE_SIZE}`,
        token
      );
      setProducts(data.items ?? []);
      setTotalPages(Math.max(1, Math.ceil((data.items?.length ?? 0) / PAGE_SIZE)));
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(1); }, [load]);

  const setEdit = (id: string, field: keyof EditableFields, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getVal = (p: Product, field: keyof EditableFields): string => {
    if (edits[p.id]?.[field] !== undefined) return edits[p.id][field]!;
    if (field === "price") return p.price !== null ? String(p.price) : "";
    if (field === "stock_qty") return String(p.stock_qty);
    if (field === "reorder_point") return String(p.reorder_point);
    if (field === "sku") return p.sku ?? "";
    if (field === "name") return p.name;
    return "";
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    setSelected(filtered.length === selected.size ? new Set() : new Set(filtered.map((p) => p.id)));
  };

  const applyBulkAction = () => {
    if (!bulkValue || selected.size === 0) return;
    const updated: Record<string, EditableFields> = { ...edits };
    selected.forEach((id) => {
      if (!updated[id]) updated[id] = {};
      if (bulkAction === "price") updated[id].price = bulkValue;
      if (bulkAction === "stock") updated[id].stock_qty = bulkValue;
      if (bulkAction === "reorder") updated[id].reorder_point = bulkValue;
    });
    setEdits(updated);
    setBulkAction(null);
    setBulkValue("");
  };

  const saveChanges = async () => {
    if (!token || Object.keys(edits).length === 0) return;
    setSaveStatus("saving");
    try {
      const updates = Object.entries(edits).map(([id, fields]) => {
        const u: Record<string, unknown> = { id };
        if (fields.name !== undefined) u.name = fields.name;
        if (fields.price !== undefined) u.price = parseFloat(fields.price) || null;
        if (fields.stock_qty !== undefined) u.stock_qty = parseInt(fields.stock_qty, 10) || 0;
        if (fields.sku !== undefined) u.sku = fields.sku || null;
        if (fields.reorder_point !== undefined) u.reorder_point = parseInt(fields.reorder_point, 10) || 5;
        return u;
      });
      await apiFetch("/api/v1/products/bulk-update", token, {
        method: "POST",
        body: JSON.stringify({ updates }),
      });
      setEdits({});
      setSaveStatus("saved");
      await load(page);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    }
  };

  const bulkDelete = async () => {
    if (!token || selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} product${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          apiFetch(`/api/v1/products/${id}`, token, { method: "DELETE" })
        )
      );
      setSelected(new Set());
      await load(page);
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  });

  const pendingEdits = Object.keys(edits).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingEdits > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
              {pendingEdits} unsaved change{pendingEdits > 1 ? "s" : ""}
            </span>
          )}
          {pendingEdits > 0 && (
            <button
              onClick={saveChanges}
              disabled={saveStatus === "saving"}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved!" : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search by name, SKU, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-blue-700">{selected.size} selected</span>
            <div className="h-3 w-px bg-blue-200" />
            <select
              className="text-xs text-blue-700 bg-transparent font-medium focus:outline-none cursor-pointer"
              value={bulkAction ?? ""}
              onChange={(e) => { setBulkAction(e.target.value as BulkAction); setBulkValue(""); }}
            >
              <option value="">Bulk action…</option>
              <option value="price">Set price</option>
              <option value="stock">Set stock</option>
              <option value="reorder">Set reorder point</option>
              <option value="delete">Delete selected</option>
            </select>
          </div>
        )}
        {bulkAction && bulkAction !== "delete" && (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="number"
              className="border rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={bulkAction === "price" ? "0.00" : "0"}
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyBulkAction()}
            />
            <button
              onClick={applyBulkAction}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
            >
              Apply to {selected.size}
            </button>
            <button
              onClick={() => { setBulkAction(null); setBulkValue(""); }}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
        {bulkAction === "delete" && (
          <button
            onClick={bulkDelete}
            disabled={saving}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Deleting…" : `Delete ${selected.size} product${selected.size > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {search ? "No products match your search." : "No products yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                      className="rounded accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Stock</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Reorder at</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => {
                  const isSelected = selected.has(p.id);
                  const isDirty = !!edits[p.id];
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${isSelected ? "bg-blue-50/40" : isDirty ? "bg-amber-50/30" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-9 h-9 rounded-lg object-contain bg-gray-50 border border-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-lg">📦</div>
                          )}
                          <div className="min-w-0">
                            <InlineEdit
                              value={getVal(p, "name")}
                              onSave={(v) => setEdit(p.id, "name", v)}
                            />
                            {p.description && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <InlineEdit
                          value={getVal(p, "sku")}
                          onSave={(v) => setEdit(p.id, "sku", v)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineEdit
                          value={getVal(p, "price")}
                          onSave={(v) => setEdit(p.id, "price", v)}
                          type="number"
                          prefix="$"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineEdit
                          value={getVal(p, "stock_qty")}
                          onSave={(v) => setEdit(p.id, "stock_qty", v)}
                          type="number"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineEdit
                          value={getVal(p, "reorder_point")}
                          onSave={(v) => setEdit(p.id, "reorder_point", v)}
                          type="number"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {isDirty ? (
                          <span className="text-xs text-amber-600 font-medium">● Modified</span>
                        ) : (
                          <StockPill qty={p.stock_qty} reorder={p.reorder_point} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => load(page - 1)}
              disabled={page === 1}
              className="text-sm text-gray-500 disabled:opacity-30 hover:text-gray-800"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page === totalPages}
              className="text-sm text-gray-500 disabled:opacity-30 hover:text-gray-800"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Save bar — sticky at bottom when there are unsaved changes */}
      {pendingEdits > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm">{pendingEdits} unsaved change{pendingEdits > 1 ? "s" : ""}</span>
          <button
            onClick={() => setEdits({})}
            className="text-xs text-gray-400 hover:text-white"
          >
            Discard
          </button>
          <button
            onClick={saveChanges}
            disabled={saveStatus === "saving"}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved!" : "Save All Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
