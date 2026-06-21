"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface SaveProfileCardProps {
  // All fields are optional — agent sends only what the user provided
  business_name?: string;
  shop_description?: string;
  entity_type?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  shipping_policy?: string;
  cancellation_policy?: string;
  shipping_flat_rate_cents?: number;
  shipping_free_threshold_cents?: number;
}

const FIELD_LABELS: Record<string, string> = {
  business_name: "Business Name",
  shop_description: "Shop Description",
  entity_type: "Entity Type",
  address_line1: "Address",
  address_line2: "Address Line 2",
  city: "City",
  state: "State",
  postal_code: "ZIP / Postal Code",
  country: "Country",
  contact_email: "Email",
  contact_phone: "Phone",
  website: "Website",
  shipping_policy: "Shipping Policy",
  cancellation_policy: "Cancellation Policy",
  shipping_flat_rate_cents: "Flat Shipping Rate",
  shipping_free_threshold_cents: "Free Shipping Above",
};

function formatValue(key: string, value: unknown): string {
  if ((key === "shipping_flat_rate_cents" || key === "shipping_free_threshold_cents") && typeof value === "number") {
    return `$${(value / 100).toFixed(2)}`;
  }
  return String(value ?? "");
}

export function SaveProfileCard(props: SaveProfileCardProps) {
  const { token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = Object.entries(props).filter(([, v]) => v !== undefined && v !== null && v !== "");

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/admin/profile", token, {
        method: "POST",
        body: JSON.stringify(props),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-emerald-700 font-semibold">
          {saved ? "✓ Saved" : "Review & Save"}
        </span>
        {!saved && (
          <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
            Business Profile
          </span>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        {fields.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-xs text-gray-500 w-28 shrink-0">{FIELD_LABELS[key] ?? key}</span>
            <span className="text-xs font-medium text-gray-800 break-words">{formatValue(key, value)}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {!saved ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save to Business Profile"}
        </button>
      ) : (
        <p className="text-xs text-emerald-600 text-center font-medium">
          Business profile updated ✓
        </p>
      )}
    </div>
  );
}
